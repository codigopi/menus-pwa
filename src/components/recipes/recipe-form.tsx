"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Camera, ChevronDown, CircleMinus, ImagePlus, Plus, Rows3, X } from "lucide-react";
import { saveRecipe } from "@/app/(app)/recetas/actions";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ListGroup } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import { StarRating } from "@/components/ui/star-rating";
import { Stepper } from "@/components/ui/stepper";
import { Switch } from "@/components/ui/switch";
import { compressImage } from "@/lib/image/compress";
import { photoUrl } from "@/lib/photo-url";
import {
  normalizeTags,
  recipeInputSchema,
  SOURCE_LABELS,
  SOURCE_TYPES,
  SUGGESTED_TAGS,
  tagLabel,
  type SourceType,
} from "@/lib/domain/recipe";
import {
  emptyIngredient,
  emptyStep,
  formToRecipeInput,
  newKey,
  type IngredientEntry,
  type RecipeFormState,
} from "@/lib/domain/recipe-form";
import { parseQuantity } from "@/lib/domain/quantity";
import { UNIT_GROUPS, UNITS, unitLabel, type UnitKey } from "@/lib/domain/units";

type ItemEntry = Extract<IngredientEntry, { kind: "item" }>;

const inputBase = "w-full bg-transparent outline-none placeholder:text-muted/70";

/**
 * Formulario de alta/edición de receta. Mantiene todo el estado en cliente y
 * envía un único FormData (JSON + foto) a la Server Action `saveRecipe`.
 */
export function RecipeForm({
  initial,
  recipeId,
  initialPhoto = null,
  draftPhoto = null,
  cancelHref,
  onCancel,
  title,
  notice,
}: {
  initial: RecipeFormState;
  recipeId?: string;
  /** Foto actual de una receta guardada. */
  initialPhoto?: string | null;
  /** Foto descargada por el importador (aún sin receta asociada). */
  draftPhoto?: string | null;
  /** Destino de "Cancelar"; si se pasa onCancel, se usa en su lugar. */
  cancelHref?: string;
  onCancel?: () => void;
  title?: string;
  /** Aviso opcional sobre el formulario (p. ej. advertencias del importador). */
  notice?: ReactNode;
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const errorsRef = useRef<HTMLDivElement>(null);

  // ---- Foto ---------------------------------------------------------------
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    setCompressing(true);
    const small = await compressImage(file);
    setCompressing(false);
    setPhotoFile(small);
    setPreviewUrl(URL.createObjectURL(small));
    setRemovePhoto(false);
  }

  function clearPhoto() {
    setPhotoFile(null);
    setPreviewUrl(null);
    setRemovePhoto(true);
    if (fileInput.current) fileInput.current.value = "";
  }

  const storedPhoto = initialPhoto ?? draftPhoto;
  const shownPhoto = previewUrl ?? (storedPhoto && !removePhoto ? photoUrl(storedPhoto) : null);

  // ---- Helpers de estado --------------------------------------------------
  const set = <K extends keyof RecipeFormState>(key: K, value: RecipeFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const patchIngredient = (key: string, patch: Partial<ItemEntry> | { label: string }) =>
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((i) => (i.key === key ? ({ ...i, ...patch } as IngredientEntry) : i)),
    }));

  const removeIngredient = (key: string) =>
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((i) => i.key !== key) }));

  function addIngredient(afterKey?: string) {
    const entry = emptyIngredient();
    setForm((f) => {
      const list = [...f.ingredients];
      const idx = afterKey ? list.findIndex((i) => i.key === afterKey) : -1;
      list.splice(idx >= 0 ? idx + 1 : list.length, 0, entry);
      return { ...f, ingredients: list };
    });
    setFocusKey(entry.key);
  }

  function addSection() {
    const entry: IngredientEntry = { key: newKey(), kind: "section", label: "" };
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, entry, emptyIngredient()] }));
    setFocusKey(entry.key);
  }

  function addStep() {
    const step = emptyStep();
    setForm((f) => ({ ...f, steps: [...f.steps, step] }));
    setFocusKey(step.key);
  }

  function moveStep(index: number, delta: -1 | 1) {
    setForm((f) => {
      const steps = [...f.steps];
      const target = index + delta;
      if (target < 0 || target >= steps.length) return f;
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...f, steps };
    });
  }

  // ---- Envío --------------------------------------------------------------
  function showErrors(list: string[]) {
    setErrors(list);
    requestAnimationFrame(() => errorsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  function submit() {
    const conv = formToRecipeInput(form);
    if (!conv.ok) return showErrors(conv.errors);
    const check = recipeInputSchema.safeParse(conv.data);
    if (!check.success) return showErrors([...new Set(check.error.issues.map((i) => i.message))]);

    const fd = new FormData();
    fd.set("data", JSON.stringify(conv.data));
    if (recipeId) fd.set("id", recipeId);
    if (photoFile) fd.set("photo", photoFile);
    if (removePhoto) fd.set("removePhoto", "1");
    else if (!photoFile && draftPhoto) fd.set("draftPhoto", draftPhoto);

    setErrors([]);
    startTransition(async () => {
      const res = await saveRecipe(fd);
      if (res && !res.ok) showErrors(res.errors);
    });
  }

  const saveLabel = pending ? "Guardando…" : "Guardar";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="pb-10"
    >
      <PageHeader
        title={title ?? (recipeId ? "Editar receta" : "Nueva receta")}
        large={false}
        back={{ href: cancelHref ?? "/recetas", onClick: onCancel, label: "Cancelar" }}
        actions={
          <button type="submit" disabled={pending || compressing} className="tap text-[17px] font-semibold text-accent disabled:opacity-40">
            {saveLabel}
          </button>
        }
      />

      <div className="pt-3">
        {notice}

        {/* Foto */}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPickPhoto(e.target.files?.[0])}
        />
        {shownPhoto ? (
          <div className="relative mb-6 overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shownPhoto} alt="Foto de la receta" className="aspect-[16/10] w-full object-cover" />
            <div className="absolute right-2 bottom-2 flex gap-2">
              <PhotoButton onClick={() => fileInput.current?.click()}>
                <Camera className="size-4" /> Cambiar
              </PhotoButton>
              <PhotoButton onClick={clearPhoto}>
                <X className="size-4" /> Quitar
              </PhotoButton>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="tap mb-6 flex aspect-[16/7] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-fill-strong text-muted"
          >
            <ImagePlus className="size-8" strokeWidth={1.5} />
            <span className="text-[15px] font-medium">{compressing ? "Preparando foto…" : "Añadir foto"}</span>
          </button>
        )}

        {/* Básico */}
        <ListGroup>
          <div className="px-4 py-3">
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Título de la receta"
              aria-label="Título"
              enterKeyHint="next"
              className={cn(inputBase, "text-[20px] font-semibold")}
            />
          </div>
          <div className="px-4 py-3">
            <AutoTextarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Descripción breve (opcional)"
              aria-label="Descripción"
              className={cn(inputBase, "resize-none text-[16px] leading-snug")}
            />
          </div>
        </ListGroup>

        {/* Detalles */}
        <ListGroup header="Detalles">
          <FieldRow label="Raciones">
            <Stepper value={form.servings} onChange={(v) => set("servings", v)} label="Raciones" />
          </FieldRow>
          <FieldRow label="Preparación">
            <MinutesInput value={form.prepMinutes} onChange={(v) => set("prepMinutes", v)} label="Minutos de preparación" />
          </FieldRow>
          <FieldRow label="Cocción">
            <MinutesInput value={form.cookMinutes} onChange={(v) => set("cookMinutes", v)} label="Minutos de cocción" />
          </FieldRow>
        </ListGroup>

        {/* Ingredientes */}
        <ListGroup
          header="Ingredientes"
          footer="Cantidad admite fracciones (1/2, 1 1/2). Déjala vacía para «al gusto»."
        >
          {form.ingredients.map((entry) =>
            entry.kind === "section" ? (
              <div key={entry.key} className="flex items-center gap-2 bg-fill/50 px-4 py-2">
                <Rows3 className="size-4 shrink-0 text-muted" />
                <input
                  value={entry.label}
                  autoFocus={focusKey === entry.key}
                  onChange={(e) => patchIngredient(entry.key, { label: e.target.value })}
                  placeholder="Nombre de la sección (p. ej. Para la salsa)"
                  aria-label="Nombre de la sección"
                  className={cn(inputBase, "text-[15px] font-semibold")}
                />
                <RemoveButton label="Quitar sección" onClick={() => removeIngredient(entry.key)} />
              </div>
            ) : (
              <IngredientRow
                key={entry.key}
                entry={entry}
                autoFocus={focusKey === entry.key}
                onChange={(patch) => patchIngredient(entry.key, patch)}
                onRemove={() => removeIngredient(entry.key)}
                onEnter={() => addIngredient(entry.key)}
              />
            ),
          )}
          <div className="flex divide-x divide-hairline">
            <AddButton onClick={() => addIngredient()}>Ingrediente</AddButton>
            <AddButton onClick={addSection}>Sección</AddButton>
          </div>
        </ListGroup>

        {/* Pasos */}
        <ListGroup header="Preparación">
          {form.steps.map((step, i) => (
            <div key={step.key} className="flex gap-3 px-4 py-3">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-bold text-accent">
                {i + 1}
              </span>
              <AutoTextarea
                value={step.text}
                autoFocus={focusKey === step.key}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    steps: f.steps.map((s) => (s.key === step.key ? { ...s, text: e.target.value } : s)),
                  }))
                }
                placeholder={i === 0 ? "Describe el primer paso…" : "Siguiente paso…"}
                aria-label={`Paso ${i + 1}`}
                className={cn(inputBase, "min-h-6 flex-1 resize-none text-[16px] leading-snug")}
              />
              <div className="flex shrink-0 flex-col items-center gap-1 text-muted">
                <IconButton label="Subir paso" disabled={i === 0} onClick={() => moveStep(i, -1)}>
                  <ArrowUp className="size-4" />
                </IconButton>
                <IconButton label="Bajar paso" disabled={i === form.steps.length - 1} onClick={() => moveStep(i, 1)}>
                  <ArrowDown className="size-4" />
                </IconButton>
              </div>
              <RemoveButton
                label="Quitar paso"
                onClick={() => setForm((f) => ({ ...f, steps: f.steps.filter((s) => s.key !== step.key) }))}
              />
            </div>
          ))}
          <AddButton onClick={addStep}>Paso</AddButton>
        </ListGroup>

        {/* Etiquetas */}
        <TagEditor tags={form.tags} onChange={(tags) => set("tags", tags)} />

        {/* Valoración y origen */}
        <ListGroup header="Valoración y origen">
          <FieldRow label="Valoración">
            <StarRating value={form.rating} onChange={(v) => set("rating", v)} size="md" />
          </FieldRow>
          <FieldRow label="Favorita">
            <Switch checked={form.isFavorite} onChange={(v) => set("isFavorite", v)} label="Favorita" />
          </FieldRow>
          <FieldRow label="Origen">
            <select
              value={form.sourceType}
              onChange={(e) => set("sourceType", e.target.value as SourceType)}
              aria-label="Origen"
              className="bg-transparent text-right text-muted outline-none"
            >
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SOURCE_LABELS[t]}
                </option>
              ))}
            </select>
          </FieldRow>
          <div className="px-4 py-3">
            <input
              type="url"
              inputMode="url"
              value={form.sourceUrl}
              onChange={(e) => set("sourceUrl", e.target.value)}
              placeholder="Enlace de la fuente (opcional)"
              aria-label="Enlace de la fuente"
              className={inputBase}
            />
          </div>
        </ListGroup>

        {errors.length > 0 && (
          <div ref={errorsRef} role="alert" className="mb-5 rounded-2xl bg-danger/10 px-4 py-3 text-[15px] text-danger">
            <ul className="list-inside list-disc space-y-0.5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <Button type="submit" size="lg" disabled={pending || compressing}>
          {pending ? "Guardando…" : "Guardar receta"}
        </Button>
      </div>
    </form>
  );
}

// ---- Subcomponentes -------------------------------------------------------

function IngredientRow({
  entry,
  autoFocus,
  onChange,
  onRemove,
  onEnter,
}: {
  entry: ItemEntry;
  autoFocus: boolean;
  onChange: (patch: Partial<ItemEntry>) => void;
  onRemove: () => void;
  onEnter: () => void;
}) {
  const qtyRef = useRef<HTMLInputElement>(null);
  const unit = UNITS.find((u) => u.key === entry.unit);
  // Intro en el nombre → salta a la cantidad; Intro en cantidad/nota → nuevo ingrediente.
  const onNameKey = (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    qtyRef.current?.focus();
  };
  const onNextKey = (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    onEnter();
  };

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        {/* Línea 1: nombre del ingrediente, a todo el ancho */}
        <input
          value={entry.name}
          autoFocus={autoFocus}
          onChange={(e) => onChange({ name: e.target.value })}
          onKeyDown={onNameKey}
          placeholder="Ingrediente (p. ej. cebolla)"
          aria-label="Ingrediente"
          enterKeyHint="next"
          className="block w-full bg-transparent text-[17px] outline-none placeholder:text-muted/70"
        />

        {/* Línea 2: cantidad · unidad · nota */}
        <div className="mt-2 flex items-center gap-2">
          <input
            ref={qtyRef}
            value={entry.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
            onKeyDown={onNextKey}
            placeholder="Cant."
            aria-label="Cantidad"
            enterKeyHint="next"
            className="h-8 w-16 shrink-0 rounded-lg bg-fill px-2 text-center tabular-nums outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-accent/30"
          />

          {/* Selector de unidad: pastilla visible + <select> nativo invisible encima
              (en iPhone abre la rueda de selección del sistema). */}
          <label
            className={cn(
              "relative flex h-8 shrink-0 items-center gap-1 rounded-lg bg-fill pr-2 pl-3 text-[15px] focus-within:ring-2 focus-within:ring-accent/30",
              unit ? "text-ink" : "text-muted/80",
            )}
          >
            {unit ? unitLabelFor(unit.key, entry.quantity) : "unidad"}
            <ChevronDown className="size-3.5 text-muted" />
            <select
              value={entry.unit}
              onChange={(e) => onChange({ unit: e.target.value as UnitKey | "" })}
              aria-label="Unidad"
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="">Sin unidad</option>
              {UNIT_GROUPS.map((g) => (
                <optgroup key={g.dimension} label={g.label}>
                  {UNITS.filter((u) => u.dimension === g.dimension).map((u) => (
                    <option key={u.key} value={u.key}>
                      {u.plural}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <input
            value={entry.note}
            onChange={(e) => onChange({ note: e.target.value })}
            onKeyDown={onNextKey}
            placeholder="nota"
            aria-label="Nota del ingrediente"
            className="h-8 min-w-0 flex-1 bg-transparent text-muted outline-none placeholder:text-muted/60"
          />
        </div>
      </div>
      <RemoveButton label="Quitar ingrediente" onClick={onRemove} />
    </div>
  );
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = (value: string) => {
    onChange(normalizeTags([...tags, ...value.split(",")]));
    setDraft("");
  };
  const suggestions = SUGGESTED_TAGS.filter((t) => !tags.includes(t));

  return (
    <ListGroup header="Etiquetas">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        {tags.map((t) => (
          <span key={t} className="flex h-8 items-center gap-1 rounded-full bg-accent-soft pr-1.5 pl-3 text-[14px] font-medium text-accent">
            {tagLabel(t)}
            <button
              type="button"
              aria-label={`Quitar ${t}`}
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="tap grid size-5 place-items-center rounded-full"
            >
              <X className="size-3.5" strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
              e.preventDefault();
              add(draft);
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={tags.length ? "Añadir…" : "Añadir etiqueta…"}
          aria-label="Nueva etiqueta"
          enterKeyHint="done"
          className={cn(inputBase, "min-w-28 flex-1")}
        />
      </div>
      {suggestions.length > 0 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
          {suggestions.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange([...tags, t])}
              className="tap flex h-8 shrink-0 items-center gap-1 rounded-full bg-fill px-3 text-[14px] whitespace-nowrap text-ink"
            >
              <Plus className="size-3.5" /> {tagLabel(t)}
            </button>
          ))}
        </div>
      )}
    </ListGroup>
  );
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-2">
      <span className="text-[17px]">{label}</span>
      {children}
    </div>
  );
}

function MinutesInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="flex items-baseline gap-1 text-muted">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        inputMode="numeric"
        placeholder="0"
        aria-label={label}
        className="w-14 bg-transparent text-right text-ink tabular-nums outline-none placeholder:text-muted/60"
      />
      min
    </label>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="tap mt-0.5 shrink-0 text-danger">
      <CircleMinus className="size-[22px] fill-danger text-card" />
    </button>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className="tap disabled:opacity-25">
      {children}
    </button>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap flex min-h-12 flex-1 items-center justify-center gap-1.5 text-[16px] font-medium text-accent"
    >
      <Plus className="size-[18px]" strokeWidth={2.4} /> {children}
    </button>
  );
}

function PhotoButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap flex h-9 items-center gap-1.5 rounded-full bg-black/45 px-3.5 text-[14px] font-medium text-white backdrop-blur-md"
    >
      {children}
    </button>
  );
}

/** Unidad concordando con lo escrito en cantidad ("1 diente", "2 dientes"). */
function unitLabelFor(key: UnitKey, quantityText: string): string {
  const q = parseQuantity(quantityText);
  return unitLabel(key, q === null || Number.isNaN(q) ? 1 : q);
}

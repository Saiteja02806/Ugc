"use client";

import Image from "next/image";
import { Fragment, useCallback, useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
  Dices,
  Eye,
  Glasses,
  Layers,
  Globe,
  Image as ImageIcon,
  Palette,
  Plus,
  Ruler,
  Scissors,
  Shirt,
  Smile,
  Upload,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import {
  CATEGORY_DEFINITIONS,
  toggleInfluencerAccessory,
  isInfluencerAccessorySelected,
  DEFAULT_INFLUENCER_SELECTION,
  findTraitById,
  getTraitsByCategory,
  type InfluencerSelectionState,
  type InfluencerTrait,
  type TraitCategory,
} from "@/lib/characters/influencer-registry";
import { changedInfluencerPills, compileInfluencerPrompt } from "@/lib/characters/master-prompt-compiler";
import { studioTraitImageUrl } from "@/lib/characters/studio-catalog";
import styles from "./influencer-studio.module.css";

const CATEGORY_ICON_MAP: Record<string, typeof User> = {
  User,
  Image: ImageIcon,
  Globe,
  Users,
  Palette,
  Smile,
  UserCheck,
  Eye,
  Scissors,
  Shirt,
  Ruler,
  Activity,
  Glasses,
};

interface InfluencerCustomizerDockProps {
  selection: InfluencerSelectionState;
  onSelectionChange: (patch: Partial<InfluencerSelectionState>) => void;
  onResetAll: () => void;
  onRandomize: () => void;
  batchSize: number;
  onBatchSizeChange: (size: number) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  maxBatchSize?: number;
  availabilityMessage?: string | null;
  generateDisabled?: boolean;
  disabled?: boolean;
  customCharacters?: InfluencerTrait[];
  onUploadCharacter?: (trait: InfluencerTrait, file: File) => void;
  onRemoveCustomCharacter?: (traitId: string) => void;
}

export function InfluencerCustomizerDock({
  selection,
  onSelectionChange,
  onResetAll,
  onRandomize,
  batchSize,
  onBatchSizeChange,
  isGenerating,
  onGenerate,
  maxBatchSize = 3,
  availabilityMessage = null,
  generateDisabled = false,
  disabled = false,
  customCharacters = [],
  onUploadCharacter,
  onRemoveCustomCharacter,
}: InfluencerCustomizerDockProps) {
  // Default initial open sections
  const [openSections, setOpenSections] = useState<Set<TraitCategory>>(
    () => new Set(["character_type", "background", "ethnicity", "build", "hair_style", "eyes"])
  );
  const [patchVariantsOpen, setPatchVariantsOpen] = useState(false);
  const patchVariantIds = ["accessory_clear_patches", "accessory_rose_patches"];

  const toggleSection = useCallback((catId: TraitCategory) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }, []);

  const handleTraitClick = useCallback(
    (trait: InfluencerTrait) => {
      if (disabled || isGenerating) return;

      switch (trait.category) {
        case "character_type":
          onSelectionChange({ characterTypeId: trait.id });
          break;
        case "background":
          onSelectionChange({ backgroundId: trait.id });
          break;
        case "gender":
          onSelectionChange({ genderId: trait.id });
          break;
        case "ethnicity":
          onSelectionChange({ ethnicityId: trait.id });
          break;
        case "age":
          onSelectionChange({ ageId: trait.id });
          break;
        case "skin_tone":
          onSelectionChange({ skinToneId: trait.id });
          break;
        case "head_shape":
          onSelectionChange({ headShapeId: trait.id });
          break;
        case "neck":
          onSelectionChange({ neckId: trait.id });
          break;
        case "eyes":
          onSelectionChange({ eyeShapeId: trait.id });
          break;
        case "eye_color":
          onSelectionChange({ eyeColorId: trait.id });
          break;
        case "hair_style":
          onSelectionChange({ hairStyleId: trait.id });
          break;
        case "hair_color":
          onSelectionChange({ hairColorId: trait.id });
          break;
        case "outfit":
          onSelectionChange({ outfitId: trait.id });
          break;
        case "outfit_color":
          onSelectionChange({ outfitColorId: trait.id });
          break;
        case "height":
          onSelectionChange({ heightId: trait.id });
          break;
        case "build":
          onSelectionChange({ buildId: trait.id });
          break;
        case "accessories": {
          const next = toggleInfluencerAccessory(selection.accessoryIds, trait.id);
          onSelectionChange({ accessoryIds: next });
          break;
        }
      }
    },
    [disabled, isGenerating, onSelectionChange, selection.accessoryIds]
  );

  const isTraitSelected = useCallback(
    (trait: InfluencerTrait) => {
      switch (trait.category) {
        case "character_type":
          return selection.characterTypeId === trait.id;
        case "background":
          return selection.backgroundId === trait.id;
        case "gender":
          return selection.genderId === trait.id;
        case "ethnicity":
          return selection.ethnicityId === trait.id;
        case "age":
          return selection.ageId === trait.id;
        case "skin_tone":
          return selection.skinToneId === trait.id;
        case "head_shape":
          return selection.headShapeId === trait.id;
        case "neck":
          return selection.neckId === trait.id;
        case "eyes":
          return selection.eyeShapeId === trait.id;
        case "eye_color":
          return selection.eyeColorId === trait.id;
        case "hair_style":
          return selection.hairStyleId === trait.id;
        case "hair_color":
          return selection.hairColorId === trait.id;
        case "outfit":
          return selection.outfitId === trait.id;
        case "outfit_color":
          return selection.outfitColorId === trait.id;
        case "height":
          return selection.heightId === trait.id;
        case "build":
          return selection.buildId === trait.id;
        case "accessories":
          return isInfluencerAccessorySelected(selection.accessoryIds, trait.id);
      }
    },
    [selection]
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;

      const previewUrl = URL.createObjectURL(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, "").slice(0, 15) || "Custom Face";

      const newTrait: InfluencerTrait = {
        id: `upload_${Date.now()}`,
        label: cleanName,
        category: "character_type",
        imagePath: previewUrl,
        promptSnippet: `custom uploaded face likeness with the facial bone structure, facial identity, and authentic skin texture of ${cleanName}`,
        isCustomUpload: true,
      };

      onUploadCharacter?.(newTrait, file);
      onSelectionChange({ characterTypeId: newTrait.id });
      e.target.value = "";
    },
    [onUploadCharacter, onSelectionChange]
  );

  const uploadedCustomFace = useMemo(() => {
    return customCharacters.find(
      (c) => c.isCustomUpload && c.category === "character_type"
    );
  }, [customCharacters]);

  const compiled = useMemo(
    () => compileInfluencerPrompt(selection, customCharacters),
    [selection, customCharacters]
  );
  const pickedSettings = useMemo(
    () => changedInfluencerPills(selection, compiled.displayPills),
    [selection, compiled.displayPills]
  );

  return (
    <aside className={styles.customizerDock}>
      {/* Accordion Categories */}
      <div className={styles.accordionScroll}>
        {/* Top Horizontal Photo Upload Banner */}
        {uploadedCustomFace ? (
          <div
            className={`${styles.topUploadBanner} ${
              selection.characterTypeId === uploadedCustomFace.id
                ? styles.traitCardSelected
                : ""
            }`}
            onClick={() => onSelectionChange({ characterTypeId: uploadedCustomFace.id })}
            role="button"
            tabIndex={0}
            title={`Select uploaded photo: ${uploadedCustomFace.label}`}
          >
            <div className={styles.topUploadLeft}>
              <img
                src={uploadedCustomFace.imagePath}
                alt={uploadedCustomFace.label}
                className={styles.topUploadThumbnail}
              />
              <div className={styles.topUploadMeta}>
                <span className={styles.topUploadTitle}>
                  {uploadedCustomFace.label}
                </span>
                <span className={styles.topUploadSubtext}>
                  {selection.characterTypeId === uploadedCustomFace.id
                    ? "Active reference photo"
                    : "Click to select custom photo"}
                </span>
              </div>
            </div>
            <div className={styles.topUploadRight}>
              <button
                type="button"
                className={styles.topUploadRemoveBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveCustomCharacter?.(uploadedCustomFace.id);
                  if (selection.characterTypeId === uploadedCustomFace.id) {
                    onSelectionChange({ characterTypeId: "char_average" });
                  }
                }}
                title="Remove photo"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <label className={styles.topUploadBanner} title="Upload your photo">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className={styles.topUploadInput}
              onChange={handleFileUpload}
              disabled={disabled || isGenerating}
            />
            <div className={styles.topUploadLeft}>
              <div className={styles.topUploadIconBubble}>
                <ImageIcon className={styles.topUploadIcon} />
              </div>
              <div className={styles.topUploadMeta}>
                <span className={styles.topUploadTitle}>Upload your photo</span>
                <span className={styles.topUploadSubtext}>Use custom face as reference</span>
              </div>
            </div>
            <div className={styles.topUploadRight}>
              <span className={styles.topUploadOptionalBadge}>Optional</span>
            </div>
          </label>
        )}

        {CATEGORY_DEFINITIONS.map((cat) => {
          const isOpen = openSections.has(cat.id);
          const traits = getTraitsByCategory(cat.id);
          const isColorCategory = ["skin_tone", "eye_color", "hair_color", "outfit_color"].includes(cat.id);
          const categoryTraits = traits;
          const visibleTraits = categoryTraits.filter(trait => patchVariantsOpen || !patchVariantIds.includes(trait.id));
          const IconComp = CATEGORY_ICON_MAP[cat.iconName] ?? User;

          return (
            <div key={cat.id} className={styles.accordionSection}>
              <button
                type="button"
                className={styles.accordionHeader}
                onClick={() => toggleSection(cat.id)}
                aria-expanded={isOpen}
              >
                <div className={styles.accordionTitleGroup}>
                  <IconComp className={styles.accordionIcon} />
                  <span>{cat.title}</span>
                  <span className={styles.accordionCountBadge}>· {categoryTraits.length}</span>
                </div>
                <ChevronDown
                  className={`${styles.accordionChevron} ${isOpen ? styles.accordionChevronOpen : ""}`}
                />
              </button>

              {isOpen && isColorCategory ? (
                <div className={styles.colorTileGrid}>
                  {categoryTraits.map((trait) => {
                    const selected = isTraitSelected(trait);
                    return (
                      <button
                        key={trait.id}
                        type="button"
                        className={`${styles.colorTile} ${selected ? styles.colorTileSelected : ""}`}
                        title={trait.label}
                        aria-label={trait.label}
                        aria-pressed={selected}
                        disabled={disabled || isGenerating}
                        onClick={() => handleTraitClick(trait)}
                      >
                        <span
                          className={`${styles.colorTilePreview} ${trait.colorHex ? "" : styles.colorTilePreviewEmpty}`}
                          style={trait.colorHex ? { backgroundColor: trait.colorHex } : undefined}
                          aria-hidden="true"
                        >
                          {!trait.colorHex ? <User size={20} /> : null}
                        </span>
                        <span className={styles.colorTileLabel}>{trait.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : isOpen ? (
                <div className={styles.accordionContent}>
                  <div className={styles.cardsGrid}>
                    {visibleTraits.map((trait, index) => {
                      const selected = isTraitSelected(trait);
                      const displayTitle = trait.label.split("(")[0].trim();
                      const showGroup = Boolean(trait.group && trait.group !== visibleTraits[index - 1]?.group);

                      return (
                        <Fragment key={trait.id}>
                        {showGroup ? <div className={styles.cardGroupLabel}>{trait.group}</div> : null}
                        <div className={trait.id === "accessory_gold_patches" ? styles.traitCardWrapper : styles.traitCardPassthrough}>
                        <button
                          type="button"
                          className={`${styles.traitCard} ${selected ? styles.traitCardSelected : ""}`}
                          onClick={() => handleTraitClick(trait)}
                          title={trait.label}
                        >
                          {trait.imagePath ? (
                            <div className={styles.cardImageWrapper}>
                              <Image
                                src={studioTraitImageUrl(trait)!}
                                alt={trait.label}
                                fill
                                sizes="110px"
                                className={styles.cardImage}
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className={styles.swatchCardContent}>
                              <User className="w-5 h-5 text-neutral-400" />
                              <span className={styles.swatchLabel}>{displayTitle}</span>
                            </div>
                          )}

                          {/* Selected Highlight & Clean Floating Label */}
                          {selected && (
                            <div className={styles.cardSelectedPill}>
                              <span className={styles.cardSelectedPillText}>
                                {displayTitle}
                              </span>
                            </div>
                          )}
                        </button>
                        {trait.id === "accessory_gold_patches" ? (
                          <button
                            type="button"
                            className={`${styles.variantOverlay} ${selection.accessoryIds.some(id => patchVariantIds.includes(id)) ? styles.variantOverlaySelected : ""}`}
                            title={patchVariantsOpen ? "Hide patch variations" : "Show patch variations"}
                            aria-label={patchVariantsOpen ? "Hide patch variations" : "Show patch variations"}
                            aria-expanded={patchVariantsOpen}
                            disabled={disabled || isGenerating}
                            onClick={() => { if (!disabled && !isGenerating) setPatchVariantsOpen(open => !open); }}
                          >
                            <Layers size={18} aria-hidden="true" />
                          </button>
                        ) : null}
                        </div>
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Sticky Bottom Action Dock */}
      <div className={styles.dockBottomAction}>
        {pickedSettings.length > 0 ? (
          <>
            <div className={styles.pickedSettingsHeader}>
              <span className={styles.pickedSettingsTitle}>Picked settings</span>
              <button
                type="button"
                className={styles.resetAllButton}
                onClick={onResetAll}
                disabled={disabled || isGenerating}
              >
                Reset all
              </button>
            </div>
            <div className={styles.pickedPillsContainer}>
              {pickedSettings.map((pill) => (
                <span key={`${pill.category}-${pill.label}`} className={styles.pickedPill}>
                  {pill.label}
                </span>
              ))}
            </div>
          </>
        ) : null}

        <div className={styles.generationOptions}>
        <div className={styles.batchSizeRow}>
          <span className={styles.batchSizeLabel}>Batch size</span>
          <div className={styles.batchSizeControl}>
            <button
              type="button"
              className={styles.batchSizeBtn}
              onClick={() => onBatchSizeChange(Math.max(1, batchSize - 1))}
              disabled={batchSize <= 1 || isGenerating}
            >
              -
            </button>
            <span className={styles.batchSizeNumber}>{batchSize}</span>
            <button
              type="button"
              className={styles.batchSizeBtn}
              onClick={() => onBatchSizeChange(Math.min(3, maxBatchSize, batchSize + 1))}
              disabled={batchSize >= Math.min(3, maxBatchSize) || isGenerating}
            >
              +
            </button>
          </div>
        </div>

        <div className={styles.batchSizeRow}>
          <span className={styles.batchSizeLabel} id="portrait-framing-label">Framing</span>
          <div className={styles.framingControl} role="radiogroup" aria-labelledby="portrait-framing-label">
            <button
              type="button"
              role="radio"
              aria-checked={selection.framing !== "half"}
              className={selection.framing !== "half" ? styles.framingOptionSelected : styles.framingOption}
              onClick={() => onSelectionChange({ framing: "full" })}
              disabled={disabled || isGenerating}
            >
              Full
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={selection.framing === "half"}
              className={selection.framing === "half" ? styles.framingOptionSelected : styles.framingOption}
              onClick={() => onSelectionChange({ framing: "half" })}
              disabled={disabled || isGenerating}
            >
              Half
            </button>
          </div>
        </div>
        </div>

        {/* Bottom CTA Row (Dice + Primary Generate Button) */}
        {availabilityMessage ? <p className={styles.availabilityMessage}>{availabilityMessage}</p> : null}
        <div className={styles.generateRow}>
          <button
            type="button"
            className={styles.diceButton}
            onClick={onRandomize}
            title="Randomize / Surprise Me"
            disabled={disabled || isGenerating}
          >
            <Dices className="w-5 h-5" />
          </button>

          <button
            type="button"
            className={styles.generateButton}
            onClick={onGenerate}
            disabled={disabled || isGenerating || generateDisabled}
          >
            {isGenerating ? "Synthesizing..." : "Generate"}
          </button>
        </div>
      </div>
    </aside>
  );
}

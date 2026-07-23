export {
  isSystemCollectedEvidence,
  isHumanAttachedEvidence,
  resolveCollectionSource,
  partitionEvidenceBySource,
  collectionSourceLabel,
  type EvidenceCollectionSource,
} from "@/lib/evidence/collection-source";

export {
  AUTO_MAP_RULES,
  mapSignalToChecklistItem,
  mapAdAutoEvidenceTarget,
  controlsSupportedBySignal,
  type AutoEvidenceSignal,
  type AutoMapRule,
} from "@/lib/evidence/auto-map";

export {
  resolveAutoEvidencePolicy,
  retentionPolicyNote,
  gridLogicRetentionTier,
  suggestedRetentionDaysForSku,
  retentionTierLabel,
  type AutoEvidencePolicy,
} from "@/lib/evidence/policy";

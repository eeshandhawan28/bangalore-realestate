export type Tier = "free" | "pro" | "enterprise";

export interface TierLimits {
  maxProjects: number;
  maxContacts: number;
  maxUsersPerOrg: number;
  maxAiInteractionsPerDay: number;
  voiceInput: boolean;
  customTemplates: boolean;
  workflowAutomation: boolean;
  marketIntelligence: boolean;
  documentAI: boolean;
  apiAccess: boolean;
  sso: boolean;
  whiteLabeling: boolean;
  dedicatedSchema: boolean;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    maxProjects: 1,
    maxContacts: 50,
    maxUsersPerOrg: 1,
    maxAiInteractionsPerDay: 20,
    voiceInput: false,
    customTemplates: false,
    workflowAutomation: false,
    marketIntelligence: false,
    documentAI: false,
    apiAccess: false,
    sso: false,
    whiteLabeling: false,
    dedicatedSchema: false,
  },
  pro: {
    maxProjects: Infinity,
    maxContacts: Infinity,
    maxUsersPerOrg: 25,
    maxAiInteractionsPerDay: Infinity,
    voiceInput: true,
    customTemplates: true,
    workflowAutomation: true,
    marketIntelligence: true,
    documentAI: true,
    apiAccess: false,
    sso: false,
    whiteLabeling: false,
    dedicatedSchema: false,
  },
  enterprise: {
    maxProjects: Infinity,
    maxContacts: Infinity,
    maxUsersPerOrg: Infinity,
    maxAiInteractionsPerDay: Infinity,
    voiceInput: true,
    customTemplates: true,
    workflowAutomation: true,
    marketIntelligence: true,
    documentAI: true,
    apiAccess: true,
    sso: true,
    whiteLabeling: true,
    dedicatedSchema: true,
  },
};

export function getTierLimits(tier: Tier): TierLimits {
  return TIER_LIMITS[tier] ?? TIER_LIMITS.free;
}

export function canUseFeature(tier: Tier, feature: keyof TierLimits): boolean {
  const limits = getTierLimits(tier);
  const value = limits[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  return false;
}

/**
 * Throws if a tier-gated feature is not available.
 */
export function assertFeatureAccess(tier: Tier, feature: keyof TierLimits): void {
  if (!canUseFeature(tier, feature)) {
    const featureLabels: Partial<Record<keyof TierLimits, string>> = {
      voiceInput: "Voice Input",
      customTemplates: "Custom Templates",
      workflowAutomation: "Workflow Automation",
      marketIntelligence: "Market Intelligence",
      documentAI: "Document AI",
      apiAccess: "API Access",
    };
    throw new Error(
      `UPGRADE_REQUIRED: ${featureLabels[feature] ?? feature} is not available on the ${tier} plan. Upgrade to Pro or Enterprise.`
    );
  }
}

/**
 * Checks a count-based limit and throws if exceeded.
 */
export function assertWithinLimit(
  tier: Tier,
  limitKey: "maxProjects" | "maxContacts" | "maxUsersPerOrg",
  currentCount: number
): void {
  const limit = getTierLimits(tier)[limitKey];
  if (limit !== Infinity && currentCount >= limit) {
    const names = { maxProjects: "projects", maxContacts: "contacts", maxUsersPerOrg: "team members" };
    throw new Error(
      `LIMIT_REACHED: Your ${tier} plan allows up to ${limit} ${names[limitKey]}. Upgrade to add more.`
    );
  }
}

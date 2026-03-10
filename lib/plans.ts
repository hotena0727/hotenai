export const PLAN_ORDER = ["free", "light", "standard", "pro", "vip"] as const;

export type PlanCode = (typeof PLAN_ORDER)[number];

export const PLAN_LEVEL: Record<PlanCode, number> = {
    free: 0,
    light: 1,
    standard: 2,
    pro: 3,
    vip: 4,
};

export const PLAN_META: Record<
    PlanCode,
    {
        code: PlanCode;
        label: string;
        badge: string;
        isPaid: boolean;
    }
> = {
    free: {
        code: "free",
        label: "무료",
        badge: "무료 FREE",
        isPaid: false,
    },
    light: {
        code: "light",
        label: "라이트",
        badge: "라이트 LIGHT",
        isPaid: true,
    },
    standard: {
        code: "standard",
        label: "스탠다드",
        badge: "스탠다드 STANDARD",
        isPaid: true,
    },
    pro: {
        code: "pro",
        label: "프로",
        badge: "프로 PRO",
        isPaid: true,
    },
    vip: {
        code: "vip",
        label: "VIP",
        badge: "VIP",
        isPaid: true,
    },
};

export function isPlanCode(value: string): value is PlanCode {
    return (PLAN_ORDER as readonly string[]).includes(value);
}

export function parsePlanOrNull(value?: string | null): PlanCode | null {
    const v = String(value || "").trim().toLowerCase();
    return isPlanCode(v) ? v : null;
}

export function normalizePlan(value?: string | null): PlanCode {
    const v = String(value || "free").trim().toLowerCase();
    return isPlanCode(v) ? v : "free";
}

export function getPlanLevel(value?: string | null): number {
    return PLAN_LEVEL[normalizePlan(value)];
}

export function hasPlan(userPlan: string | null | undefined, requiredPlan: PlanCode): boolean {
    return getPlanLevel(userPlan) >= PLAN_LEVEL[requiredPlan];
}

export function isPaidPlan(plan: string | null | undefined): boolean {
    return normalizePlan(plan) !== "free";
}

export function getPlanMeta(plan: string | null | undefined) {
    return PLAN_META[normalizePlan(plan)];
}

export function getPlanLabel(plan: string | null | undefined): string {
    return getPlanMeta(plan).label;
}

export function getPlanBadge(plan: string | null | undefined): string {
    return getPlanMeta(plan).badge;
}

export function getPlanOptions() {
    return PLAN_ORDER.map((code) => ({
        value: code,
        label: PLAN_META[code].label,
        badge: PLAN_META[code].badge,
        isPaid: PLAN_META[code].isPaid,
    }));
}

export function getPlanTheme(plan: string | null | undefined) {
    const normalized = normalizePlan(plan);

    switch (normalized) {
        case "free":
            return {
                badge: "border-gray-200 bg-gray-50 text-gray-700",
                soft: "border-gray-200 bg-white text-gray-900",
                tint: "border-gray-200 bg-gray-50",
                nav: "border-b border-gray-200 bg-white",
                navActive: "border-b-2 border-gray-500 text-gray-900",
                navInactive: "text-gray-500",
                text: "text-gray-700",
            };

        case "light":
            return {
                badge: "border-sky-200 bg-sky-50 text-sky-700",
                soft: "border-sky-200 bg-sky-50/70 text-sky-900",
                tint: "border-sky-200 bg-sky-50",
                nav: "border-b border-sky-100 bg-sky-50/60",
                navActive: "border-b-2 border-sky-500 text-sky-900",
                navInactive: "text-sky-700/80",
                text: "text-sky-700",
            };

        case "standard":
            return {
                badge: "border-violet-200 bg-violet-50 text-violet-700",
                soft: "border-violet-200 bg-violet-50/70 text-violet-900",
                tint: "border-violet-200 bg-violet-50",
                nav: "border-b border-violet-100 bg-violet-50/60",
                navActive: "border-b-2 border-violet-500 text-violet-900",
                navInactive: "text-violet-700/80",
                text: "text-violet-700",
            };

        case "pro":
            return {
                badge: "border-blue-200 bg-blue-50 text-blue-700",
                soft: "border-blue-200 bg-blue-50/70 text-blue-900",
                tint: "border-blue-200 bg-blue-50",
                nav: "border-b border-blue-100 bg-blue-50/60",
                navActive: "border-b-2 border-blue-500 text-blue-900",
                navInactive: "text-blue-700/80",
                text: "text-blue-700",
            };

        case "vip":
            return {
                badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
                soft: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
                tint: "border-emerald-200 bg-emerald-50",
                nav: "border-b border-emerald-100 bg-emerald-50/60",
                navActive: "border-b-2 border-emerald-600 text-emerald-900",
                navInactive: "text-emerald-700/80",
                text: "text-emerald-700",
            };

        default:
            return {
                badge: "border-gray-200 bg-gray-50 text-gray-700",
                soft: "border-gray-200 bg-white text-gray-900",
                tint: "border-gray-200 bg-gray-50",
                nav: "border-b border-gray-200 bg-white",
                navActive: "border-b-2 border-gray-500 text-gray-900",
                navInactive: "text-gray-500",
                text: "text-gray-700",
            };
    }
}

export function getPlanPillClass(plan: string | null | undefined) {
    return `rounded-full border px-4 py-2 text-sm font-semibold ${getPlanTheme(plan).badge}`;
}
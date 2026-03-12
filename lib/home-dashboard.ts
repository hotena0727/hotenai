import type { PlanCode } from "@/lib/plans";

export type DayBucket = {
  key: string;
  label: string;
  count: number;
};

export type BalanceItem = {
  subject: string;
  value: number;
};

export type WrongSummary = {
  weightedWordWrong: number;
  weightedKanjiWrong: number;
  weightedKatsuyouWrong: number;
  weightedTalkWrong: number;
  topWrongKind: "word" | "kanji" | "katsuyou" | "talk" | null;
};

export type SuggestedRoutine = {
  title: string;
  desc: string;
  href: string | null;
  variant: "primary" | "secondary";
  kind: "start" | "resume" | "boost" | "review";
  priority: number;
};

export type HomeDashboardSummary = {
  totalAttempts: number;
  totalWrong: number;
  wordCount: number;
  kanjiCount: number;
  katsuyouCount: number;
  talkCount: number;
  wordAvg: number;
  kanjiAvg: number;
  katsuyouAvg: number;
  talkAvg: number;
  recent7Days: DayBucket[];
  streak: number;
  todayCount: number;
  activeDays7: number;
  levelProgress: Array<{ level: string; count: number }>;
  weightedWordWrong: number;
  weightedKanjiWrong: number;
  weightedKatsuyouWrong: number;
  weightedTalkWrong: number;
};

export function calcGoalPercent(totalTodaySets: number, goalSets: number) {
  const safeGoal = Math.max(1, Number(goalSets || 1));
  return Math.min(100, Math.round((totalTodaySets / safeGoal) * 100));
}

export function getTodayMessage(totalAttempts: number, totalWrong: number) {
  if (totalAttempts === 0) {
    return "아직 학습 기록이 없어요. 오늘 첫 루틴부터 가볍게 시작해봅시다.";
  }
  if (totalAttempts < 5) {
    return "좋아요. 데이터가 조금씩 쌓이고 있어요. 오늘 한 세트만 더 해볼까요?";
  }
  if (totalWrong === 0) {
    return "좋아요. 오늘 흐름이 아주 좋습니다.";
  }
  if (totalWrong <= 3) {
    return "조금 틀려도 괜찮습니다. 오늘 루틴은 잘 이어가고 있어요.";
  }
  return "꾸준함은 재능을 이깁니다. 오늘도 한 세트 더 가봅시다.";
}

export function clampScore(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function calcReviewScore(
  totalWrong: number,
  todayCount: number,
  totalAttempts: number
) {
  if (totalAttempts === 0) return 0;

  const wrongRate = totalWrong / Math.max(1, totalAttempts);
  const routineBonus = Math.min(30, todayCount * 10);
  const base = 100 - wrongRate * 18 + routineBonus;

  return clampScore(base);
}

export function calcConsistencyScore(
  streak: number,
  activeDays7: number,
  todayCount: number
) {
  const streakPart = Math.min(45, streak * 8);
  const activePart = Math.min(40, activeDays7 * 6);
  const todayPart = Math.min(15, todayCount * 5);

  return clampScore(streakPart + activePart + todayPart);
}

export function buildBalanceData(stats: {
  wordAvg: number;
  kanjiAvg: number;
  katsuyouAvg: number;
  talkAvg: number;
  totalWrong: number;
  totalAttempts: number;
  streak: number;
  todayCount: number;
  activeDays7: number;
}): BalanceItem[] {
  return [
    { subject: "단어", value: clampScore(stats.wordAvg) },
    { subject: "한자", value: clampScore(stats.kanjiAvg) },
    { subject: "활용", value: clampScore(stats.katsuyouAvg) },
    { subject: "회화", value: clampScore(stats.talkAvg) },
    {
      subject: "복습",
      value: calcReviewScore(
        stats.totalWrong,
        stats.todayCount,
        stats.totalAttempts
      ),
    },
    {
      subject: "꾸준함",
      value: calcConsistencyScore(
        stats.streak,
        stats.activeDays7,
        stats.todayCount
      ),
    },
  ];
}

export function pickStrengthWeakness(balanceData: BalanceItem[]) {
  const sorted = [...balanceData].sort((a, b) => b.value - a.value);
  return {
    strengths: sorted.slice(0, 2).map((x) => x.subject),
    weaknesses: sorted.slice(-2).map((x) => x.subject),
  };
}

export function getBalanceValue(data: BalanceItem[], subject: string) {
  return data.find((item) => item.subject === subject)?.value ?? 0;
}

export function buildSuggestedRoutines(params: {
  isEmptyUser: boolean;
  isDormantWeek: boolean;
  canWord: boolean;
  canKanji: boolean;
  canKatsuyou: boolean;
  canTalk: boolean;
  canMyPage: boolean;
  weakest: string;
  untouchedAreas: string[];
  topWrongKind: "word" | "kanji" | "katsuyou" | "talk" | null;
}): SuggestedRoutine[] {
  const {
    isEmptyUser,
    isDormantWeek,
    canWord,
    canKanji,
    canKatsuyou,
    canTalk,
    canMyPage,
    weakest,
    untouchedAreas,
    topWrongKind,
  } = params;

  const routines: SuggestedRoutine[] = [];

  const pushRoutine = (routine: SuggestedRoutine) => {
    if (!routine.href) return;
    if (routines.some((item) => item.href === routine.href && item.title === routine.title)) return;
    routines.push(routine);
  };

  if (isEmptyUser) {
    if (canWord) {
      pushRoutine({
        title: "📝 첫 단어 루틴",
        desc: "가장 가볍게 시작하기 좋은 첫 루틴이에요.",
        href: "/word",
        variant: "primary",
        kind: "start",
        priority: 100,
      });
    }
    if (canTalk) {
      pushRoutine({
        title: "🗣️ 첫 회화 루틴",
        desc: "짧게 말해보며 앱 흐름에 익숙해질 수 있어요.",
        href: "/talk",
        variant: "secondary",
        kind: "start",
        priority: 95,
      });
    }
    if (canKanji) {
      pushRoutine({
        title: "🈯 첫 한자 루틴",
        desc: "읽기 감각을 가볍게 시작해보세요.",
        href: "/kanji",
        variant: "secondary",
        kind: "start",
        priority: 90,
      });
    }
    if (canKatsuyou) {
      pushRoutine({
        title: "🔄 첫 활용 루틴",
        desc: "문장 감각을 채우는 첫걸음으로 좋아요.",
        href: "/katsuyou",
        variant: "secondary",
        kind: "start",
        priority: 85,
      });
    }
  }

  if (isDormantWeek) {
    if (canTalk) {
      pushRoutine({
        title: "🗣️ 가벼운 회화 복귀",
        desc: "쉬었다면 회화 1세트로 다시 감을 살려보세요.",
        href: "/talk",
        variant: "primary",
        kind: "resume",
        priority: 92,
      });
    } else if (canWord) {
      pushRoutine({
        title: "📝 단어로 다시 시작",
        desc: "부담 적은 단어 루틴으로 흐름을 되살려보세요.",
        href: "/word",
        variant: "primary",
        kind: "resume",
        priority: 91,
      });
    }
  }

  untouchedAreas.forEach((area, index) => {
    if (area === "단어" && canWord) {
      pushRoutine({
        title: "📝 단어 밸런스 채우기",
        desc: "아직 단어 데이터가 적어요. 한 세트만 해보세요.",
        href: "/word",
        variant: index === 0 ? "primary" : "secondary",
        kind: "boost",
        priority: 88 - index,
      });
    }
    if (area === "한자" && canKanji) {
      pushRoutine({
        title: "🈯 한자 밸런스 채우기",
        desc: "한자 데이터를 조금만 쌓아도 밸런스가 더 정확해져요.",
        href: "/kanji",
        variant: index === 0 ? "primary" : "secondary",
        kind: "boost",
        priority: 87 - index,
      });
    }
    if (area === "활용" && canKatsuyou) {
      pushRoutine({
        title: "🔄 활용 밸런스 채우기",
        desc: "활용 문제를 한 세트 풀어 문장 감각을 보강해보세요.",
        href: "/katsuyou",
        variant: index === 0 ? "primary" : "secondary",
        kind: "boost",
        priority: 86 - index,
      });
    }
    if (area === "회화" && canTalk) {
      pushRoutine({
        title: "🗣️ 회화 밸런스 채우기",
        desc: "회화 데이터가 적어요. 짧은 세트부터 시작해보세요.",
        href: "/talk",
        variant: index === 0 ? "primary" : "secondary",
        kind: "boost",
        priority: 89 - index,
      });
    }
  });

  if (weakest === "복습" && canMyPage) {
    const reviewHref =
      topWrongKind === "talk" && canTalk
        ? "/mypage/wrong-talk"
        : topWrongKind === "word" && canWord
          ? "/mypage/wrong-word"
          : topWrongKind === "kanji" && canKanji
            ? "/mypage/wrong-kanji"
            : topWrongKind === "katsuyou" && canKatsuyou
              ? "/mypage/wrong-katsuyou"
              : canTalk
                ? "/mypage/wrong-talk"
                : canWord
                  ? "/mypage/wrong-word"
                  : canKanji
                    ? "/mypage/wrong-kanji"
                    : canKatsuyou
                      ? "/mypage/wrong-katsuyou"
                      : null;

    const reviewTitle =
      topWrongKind === "talk"
        ? "↪️ 회화 오답 복습"
        : topWrongKind === "word"
          ? "↪️ 단어 오답 복습"
          : topWrongKind === "kanji"
            ? "↪️ 한자 오답 복습"
            : topWrongKind === "katsuyou"
              ? "↪️ 활용 오답 복습"
              : "↪️ 오늘의 오답 복습";

    const reviewDesc =
      topWrongKind === "talk"
        ? "최근에는 회화 오답이 많아요. 회화 복습부터 해보세요."
        : topWrongKind === "word"
          ? "최근에는 단어 오답이 많아요. 단어 복습부터 해보세요."
          : topWrongKind === "kanji"
            ? "최근에는 한자 오답이 많아요. 한자 복습부터 해보세요."
            : topWrongKind === "katsuyou"
              ? "최근에는 활용 오답이 많아요. 활용 복습부터 해보세요."
              : "새 문제보다 오답 복습이 더 효과적인 날이에요.";

    pushRoutine({
      title: reviewTitle,
      desc: reviewDesc,
      href: reviewHref,
      variant: "primary",
      kind: "review",
      priority: 97,
    });
  }

  if (weakest === "회화" && canTalk) {
    pushRoutine({
      title: "🗣️ 회화 1세트 시작",
      desc: "말문을 먼저 열면 전체 흐름이 살아나요.",
      href: "/talk",
      variant: "primary",
      kind: "boost",
      priority: 84,
    });
  }

  if (weakest === "단어" && canWord) {
    pushRoutine({
      title: "📝 단어 1세트 시작",
      desc: "기본 어휘를 채우면 다른 영역도 함께 편해집니다.",
      href: "/word",
      variant: "primary",
      kind: "boost",
      priority: 83,
    });
  }

  if (weakest === "한자" && canKanji) {
    pushRoutine({
      title: "🈯 한자 1세트 시작",
      desc: "읽기 감각을 조금만 보강해도 밸런스가 좋아져요.",
      href: "/kanji",
      variant: "primary",
      kind: "boost",
      priority: 82,
    });
  }

  if (weakest === "활용" && canKatsuyou) {
    pushRoutine({
      title: "🔄 활용 1세트 시작",
      desc: "활용 감각을 채우면 문장이 더 자연스러워집니다.",
      href: "/katsuyou",
      variant: "primary",
      kind: "boost",
      priority: 81,
    });
  }

  if (weakest === "꾸준함") {
    if (canWord) {
      pushRoutine({
        title: "📝 짧은 루틴 다시 잇기",
        desc: "오늘은 단어 1세트만 해도 충분해요.",
        href: "/word",
        variant: "primary",
        kind: "resume",
        priority: 80,
      });
    } else if (canTalk) {
      pushRoutine({
        title: "🗣️ 짧은 회화로 재시작",
        desc: "짧게 한 세트만 해도 흐름이 이어집니다.",
        href: "/talk",
        variant: "primary",
        kind: "resume",
        priority: 79,
      });
    }
  }

  if (canMyPage) {
    const fallbackWrongHref =
      topWrongKind === "talk" && canTalk
        ? "/mypage/wrong-talk"
        : topWrongKind === "word" && canWord
          ? "/mypage/wrong-word"
          : topWrongKind === "kanji" && canKanji
            ? "/mypage/wrong-kanji"
            : topWrongKind === "katsuyou" && canKatsuyou
              ? "/mypage/wrong-katsuyou"
              : canTalk
                ? "/mypage/wrong-talk"
                : canWord
                  ? "/mypage/wrong-word"
                  : canKanji
                    ? "/mypage/wrong-kanji"
                    : canKatsuyou
                      ? "/mypage/wrong-katsuyou"
                      : null;

    const fallbackWrongTitle =
      topWrongKind === "talk"
        ? "↪️ 회화 반복오답"
        : topWrongKind === "word"
          ? "↪️ 단어 반복오답"
          : topWrongKind === "kanji"
            ? "↪️ 한자 반복오답"
            : topWrongKind === "katsuyou"
              ? "↪️ 활용 반복오답"
              : "↪️ 반복오답 루틴";

    pushRoutine({
      title: fallbackWrongTitle,
      desc: "오답부터 정리하면 점수가 더 단단해집니다.",
      href: fallbackWrongHref,
      variant: "secondary",
      kind: "review",
      priority: 70,
    });
  }

  if (canTalk) {
    pushRoutine({
      title: "🗣️ 회화 바로가기",
      desc: "가볍게 시작하기 좋은 대표 루틴이에요.",
      href: "/talk",
      variant: "secondary",
      kind: "boost",
      priority: 60,
    });
  }

  if (canWord) {
    pushRoutine({
      title: "📝 단어 바로가기",
      desc: "부담 없이 바로 시작하기 좋아요.",
      href: "/word",
      variant: "secondary",
      kind: "boost",
      priority: 59,
    });
  }

  return routines.sort((a, b) => b.priority - a.priority).slice(0, 2);
}
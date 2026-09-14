"use client";
import { CommunityFrame, useSocialText } from "@/components/social/common";
import { PeopleList } from "@/components/social/people";
export default function PeoplePage() {
  const t = useSocialText();
  return (
    <CommunityFrame>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">
        {t("Найди своих", "Өз ортаңды тап")}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {t(
          "Знакомься, подписывайся и готовься вместе.",
          "Таныс, жазыл және бірге дайындал.",
        )}
      </p>
      <PeopleList />
    </CommunityFrame>
  );
}

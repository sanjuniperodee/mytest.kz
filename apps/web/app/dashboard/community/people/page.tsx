"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { useSocialText } from "@/components/social/common";
import { PeopleList } from "@/components/social/people";

export default function PeoplePage() {
  const t = useSocialText();
  return (
    <div className="flex min-w-0 flex-col gap-6" data-no-translate>
      <PageHeader
        title={t("Люди", "Адамдар")}
        description={t(
          "Находите единомышленников, подписывайтесь и готовьтесь вместе.",
          "Пікірлестерді табыңыз, жазылыңыз және бірге дайындалыңыз.",
        )}
      />
      <PeopleList />
    </div>
  );
}

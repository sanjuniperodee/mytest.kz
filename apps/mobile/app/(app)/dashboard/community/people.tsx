import { CommunityGate } from "@/components/community/CommunityGate"
import { PeopleList } from "@/components/community/People"
import { PageHeader } from "@/components/ui/page-header"
import { Screen } from "@/components/ui/screen"
import { useTr } from "@/lib/i18n/use-tr"

export default function PeopleScreen() {
  const tr = useTr()
  return (
    <CommunityGate>
      <Screen>
        <PageHeader
          title={tr("Люди", "Адамдар")}
          description={tr(
            "Находите единомышленников, подписывайтесь и готовьтесь вместе.",
            "Пікірлестерді табыңыз, жазылыңыз және бірге дайындалыңыз.",
          )}
        />
        <PeopleList />
      </Screen>
    </CommunityGate>
  )
}

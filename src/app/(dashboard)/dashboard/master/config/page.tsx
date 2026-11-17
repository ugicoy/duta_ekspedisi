import { ConfigManager } from "@/modules/config/components/config-manager";
import { getSystemConfigs } from "@/modules/config/config.queries";

export default async function ConfigPage() {
  const configs = await getSystemConfigs();

  return <ConfigManager initialConfigs={configs} />;
}

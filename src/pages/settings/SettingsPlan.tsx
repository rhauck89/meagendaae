import CurrentPlanCard from '@/components/CurrentPlanCard';
import SettingsBreadcrumb from '@/components/SettingsBreadcrumb';

const SettingsPlan = () => {
  return (
    <div className="space-y-6">
      <SettingsBreadcrumb current="Plano" />
      <div>
        <h2 className="text-xl font-display font-bold">Plano</h2>
        <p className="text-sm text-muted-foreground">Gerencie seu plano atual e recursos disponíveis</p>
      </div>
      <CurrentPlanCard />
    </div>
  );
};

export default SettingsPlan;

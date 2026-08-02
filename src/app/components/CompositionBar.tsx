import { useAppStore } from '../store';
import type { AgentLevel, ControlLevel, AdaptationLevel, GovernanceLevel } from '../../shared/domain';

const options = {
  agent: ['A1', 'A2', 'A3', 'A4', 'A5'] as AgentLevel[],
  control: ['B1', 'B2', 'B3', 'B4', 'B5'] as ControlLevel[],
  adaptation: ['C1', 'C2', 'C3', 'C4', 'C5'] as AdaptationLevel[],
  governance: ['D1', 'D2', 'D3', 'D4', 'D5'] as GovernanceLevel[]
};

export function CompositionBar() {
  const composition = useAppStore((state) => state.composition);
  const setComposition = useAppStore((state) => state.setComposition);

  return (
    <div className="composition-bar">
      <span className="composition-label">CHART 混合智能体</span>
      <LevelSelect label="自治" value={composition.agent} values={options.agent} onChange={(agent) => setComposition({ agent })} />
      <LevelSelect label="控制" value={composition.control} values={options.control} onChange={(control) => setComposition({ control })} />
      <LevelSelect label="适应" value={composition.adaptation} values={options.adaptation} onChange={(adaptation) => setComposition({ adaptation })} />
      <LevelSelect label="治理" value={composition.governance} values={options.governance} onChange={(governance) => setComposition({ governance })} />
    </div>
  );
}

function LevelSelect<T extends string>({
  label,
  value,
  values,
  onChange
}: {
  label: string;
  value: T;
  values: readonly T[];
  onChange(value: T): void;
}) {
  return (
    <label className="level-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

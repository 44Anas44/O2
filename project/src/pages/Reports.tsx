import React, { useMemo, useState } from 'react';
import { DownloadIcon } from 'lucide-react';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Button, Field, Panel, PanelHeader, inputClass } from '../components/ui/Primitives';
import { HeadlineStats } from '../components/dashboard/StatBlocks';
import { PRESET_LABELS, presetRange, type RangePreset } from '../utils/reportRange';
import { statsFor } from '../utils/stats';
import { downloadStatsReport } from '../pdf';

const presets = Object.keys(PRESET_LABELS) as RangePreset[];

export function Reports() {
  const { sales, expenses, appointments, products } = useStore();
  const { displayName } = useAuth();
  const { center } = useSettings();
  const [preset, setPreset] = useState<RangePreset>('mois');
  const [custom, setCustom] = useState({ start: '', end: '' });
  const [busy, setBusy] = useState(false);

  const range = useMemo(() => presetRange(preset, custom), [preset, custom]);
  const valid = range.start <= range.end;
  const stats = useMemo(() => statsFor(sales, expenses, range), [sales, expenses, range]);

  const generate = async () => {
    setBusy(true);
    try {
      await downloadStatsReport({ range, sales, expenses, appointments, products, center, generatedBy: displayName });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      window.alert('Impossible de générer le rapport PDF.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Panel>
        <PanelHeader
          title="Rapport d’activité"
          subtitle="Chiffres clés, graphique, meilleures ventes, dépenses, rendez-vous, activité par utilisateur, stock et journaux détaillés."
          action={
          <Button onClick={generate} disabled={busy || !valid}>
              <DownloadIcon className="h-4 w-4" />
              {busy ? 'Génération…' : 'Télécharger le PDF'}
            </Button>
          } />
        <div className="flex flex-wrap items-end gap-4 px-5 py-5">
          <Field label="Période">
            <select className={inputClass} value={preset} onChange={(e) => setPreset(e.target.value as RangePreset)}>
              {presets.map((key) => <option key={key} value={key}>{PRESET_LABELS[key]}</option>)}
            </select>
          </Field>
          {preset === 'perso' ?
          <>
              <Field label="Du">
                <input type="date" className={inputClass} value={range.start} onChange={(e) => setCustom({ ...custom, start: e.target.value, end: custom.end || range.end })} />
              </Field>
              <Field label="Au">
                <input type="date" className={inputClass} value={range.end} onChange={(e) => setCustom({ ...custom, end: e.target.value, start: custom.start || range.start })} />
              </Field>
            </> : null}
          <p className="pb-2 text-sm capitalize text-ink-500">{range.label}</p>
        </div>
        {!valid ? <p className="px-5 pb-4 text-sm text-red-600">La date de début doit précéder la date de fin.</p> : null}
      </Panel>
      <HeadlineStats stats={stats} />
    </div>);

}

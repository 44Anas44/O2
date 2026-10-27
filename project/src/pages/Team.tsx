import React, { useCallback, useEffect, useState } from 'react';
import { MailPlusIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { invitationFromRow, profileFromRow } from '../lib/mappers';
import { useAuth } from '../contexts/AuthContext';
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from '../lib/permissions';
import type { Invitation, Profile, Role } from '../types';
import { Badge, Button, EmptyState, Field, Panel, PanelHeader, inputClass } from '../components/ui/Primitives';

export function Team() {
  const { ownerId, user } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('reception');

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('invitations').select('*').order('created_at', { ascending: false })]
    );
    setMembers((m.data ?? []).map(profileFromRow));
    setInvites((i.data ?? []).map(invitationFromRow));
    setLoading(false);
  }, []);

  useEffect(() => {load();}, [load]);

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!ownerId) return;
    const { error: err } = await supabase.from('invitations').insert({
      owner_id: ownerId,
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      role
    });
    if (err) {
      setError(err.code === '23505' ? 'Cet e-mail a déjà été invité.' : err.message);
      return;
    }
    setEmail('');
    setFullName('');
    load();
  };

  const update = async (id: string, patch: Partial<{role: Role;active: boolean;}>) => {
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m));
    const { error: err } = await supabase.from('profiles').update(patch).eq('id', id);
    if (err) {
      setError(err.message);
      load();
    }
  };

  const removeMember = async (member: Profile) => {
    if (!window.confirm(`Retirer l’accès de ${member.fullName || member.email} ?`)) return;
    await supabase.from('profiles').delete().eq('id', member.id);
    load();
  };

  const revoke = async (id: string) => {
    await supabase.from('invitations').delete().eq('id', id);
    load();
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Panel>
        <PanelHeader title="Inviter un utilisateur" subtitle="La personne s’inscrit ensuite avec cet e-mail (écran de connexion → « S’inscrire ») et reçoit automatiquement le rôle choisi." />
        <form onSubmit={invite} className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Nom complet">
            <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Amira Trabelsi" required />
          </Field>
          <Field label="E-mail">
            <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="amira@exemple.com" required />
          </Field>
          <Field label="Rôle" hint={ROLE_DESCRIPTIONS[role]} className="sm:col-span-2">
            <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </Field>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 sm:col-span-2">{error}</p> : null}
          <div className="sm:col-span-2">
            <Button type="submit"><MailPlusIcon className="h-4 w-4" />Inviter</Button>
          </div>
        </form>
        {invites.length > 0 ?
        <ul className="divide-y divide-ink-100 border-t border-ink-100">
            {invites.map((inv) =>
          <li key={inv.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate"><strong>{inv.fullName || inv.email}</strong> <span className="text-ink-500">{inv.email}</span></span>
                <Badge tone="warning">En attente · {ROLE_LABELS[inv.role]}</Badge>
                <Button size="sm" variant="ghost" onClick={() => revoke(inv.id)} aria-label="Annuler l’invitation"><Trash2Icon className="h-4 w-4" /></Button>
              </li>
          )}
          </ul> : null}
      </Panel>

      <Panel>
        <PanelHeader title="Équipe" subtitle={`${members.length} utilisateur(s)`} />
        {loading ? <p className="px-5 py-6 text-sm text-ink-500">Chargement…</p> :
        members.length === 0 ? <EmptyState icon={<UsersIcon className="h-5 w-5" />} title="Aucun utilisateur" /> :
        <ul className="divide-y divide-ink-100">
            {members.map((member) => {
            const isOwner = member.id === member.ownerId;
            const isMe = member.id === user?.id;
            const locked = isOwner || isMe;
            return (
              <li key={member.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink-900">
                      {member.fullName || member.email}
                      {isMe ? <span className="ml-2 text-xs font-normal text-ink-400">(vous)</span> : null}
                    </p>
                    <p className="truncate text-ink-500">{member.email}{isOwner ? ' · propriétaire' : ''}</p>
                  </div>
                  {!member.active ? <Badge tone="danger">Désactivé</Badge> : null}
                  <select
                  className={`${inputClass} !w-auto`}
                  value={member.role}
                  disabled={locked}
                  onChange={(e) => update(member.id, { role: e.target.value as Role })}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  {!locked ?
                <>
                      <Button size="sm" variant="secondary" onClick={() => update(member.id, { active: !member.active })}>
                        {member.active ? 'Désactiver' : 'Réactiver'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeMember(member)} aria-label="Retirer" className="text-red-500 hover:bg-red-50">
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    </> : null}
                </li>);

          })}
          </ul>
        }
      </Panel>
    </div>);

}

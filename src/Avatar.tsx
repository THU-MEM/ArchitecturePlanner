import { useMemo } from 'react'
import { createAvatar } from '@dicebear/core'
import * as initials from '@dicebear/initials'
import type { Owner, Person } from './plan.ts'

export default function Avatar({ person, role }: { person: Person; role?: Owner['role'] }) {
  const source = useMemo(() => createAvatar(initials, {
    seed: person.name,
    backgroundColor: ['176976', '345c88', '634b8c', '286452', '765921', '9c4635'],
    textColor: ['ffffff'],
    fontWeight: 600,
    radius: 50,
    size: 64,
  }).toDataUri(), [person.name])
  const label = `${role ? `${role === 'primary' ? '主 owner' : '协作 owner'} ` : ''}${person.name} 的头像`
  return <img className="avatar" src={source} alt={label} title={label} data-role={role} width={26} height={26} />
}

export function OwnerAvatars({ owners, people }: { owners: Owner[]; people: Person[] }) {
  return <div className="owner-avatars">{[...owners.filter(owner => owner.role === 'primary'), ...owners.filter(owner => owner.role === 'secondary')].map(owner => {
    const person = people.find(person => person.id === owner.personId)
    return person && <Avatar key={person.id} person={person} role={owner.role} />
  })}</div>
}

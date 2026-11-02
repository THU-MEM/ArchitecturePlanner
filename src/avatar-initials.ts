export const avatarInitialsByLogin: Readonly<Record<string, string>> = Object.freeze({
  dongaishi0927: 'DA',
  dushx666: 'DS',
  'huanghanyu-vungle': 'HH',
  hydraxman: 'BS',
  liruilingup: 'LR',
  liweican1992: 'LW',
  shaoshuaig: 'GS',
  'z-yq': 'ZY',
  zsz666666: 'ZS',
  lucia9988: 'LL',
  zhangsan649: 'ZH',
  sallelujah: 'HJ',
  'shijl-77': 'SJ',
  'hmy-abc': 'HM',
  rohnliu: 'LZ',
})

export function avatarSeed(name: string): string {
  const login = name.toLowerCase()
  return Object.hasOwn(avatarInitialsByLogin, login) ? [...avatarInitialsByLogin[login]].join(' ') : name
}

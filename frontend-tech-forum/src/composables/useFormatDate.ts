export function formatDate(date: Date): string {
  const day : string = String(date.getDate()).padStart(2, '0')
  const month : string = String(date.getMonth() + 1).padStart(2, '0')
  const year : string = String(date.getFullYear())
  const hours : string = String(date.getHours()).padStart(2, '0')
  const minutes : string = String(date.getMinutes()).padStart(2, '0')

  return `${day}/${month}/${year} - ${hours}:${minutes}`
}
import type { ConcreteSprintDayPolicy } from './types'

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function isWeekend(date: Date) {
  const day = date.getDay()
  return day === 0 || day === 6
}

export function addRocketDays(startDate: string, daysToAdd: number, policy: ConcreteSprintDayPolicy) {
  const date = new Date(`${startDate}T00:00:00`)
  if (policy === 'include') {
    date.setDate(date.getDate() + daysToAdd)
    return formatDate(date)
  }

  let added = 0
  while (added < daysToAdd) {
    date.setDate(date.getDate() + 1)
    if (!isWeekend(date)) added += 1
  }
  return formatDate(date)
}

export function getRocketDates(startDate: string, policy: ConcreteSprintDayPolicy) {
  return {
    day1: startDate,
    day2: addRocketDays(startDate, 1, policy),
    target90: addRocketDays(startDate, 2, policy)
  }
}

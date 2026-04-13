import { useState, useMemo } from 'react';
import { DAYS } from '../config/constants';
import { disciplineToCategory } from '../components/InlineCataloguePicker';
import type { CatalogueClass, ClassSchedule } from '../types/catalogue';

export function useCatalogueFilter(catalogueClasses: CatalogueClass[]) {
  const [catSearch, setCatSearch] = useState('');
  const [catDiscipline, setCatDiscipline] = useState<string | null>(null);
  const [catGym, setCatGym] = useState<string | null>(null);

  const allDisciplines = useMemo(() => [...new Set(catalogueClasses.map(c => c.discipline))].sort(), [catalogueClasses]);
  const allGyms = useMemo(() => [...new Set(catalogueClasses.map(c => c.gym))].sort(), [catalogueClasses]);

  const catalogueByDay = useMemo(() => {
    const map: Record<string, { cls: CatalogueClass; schedule: ClassSchedule }[]> = {};
    for (const day of DAYS) map[day] = [];
    for (const cls of catalogueClasses) {
      for (const sched of cls.schedules) {
        const dayName = DAYS[sched.dayOfWeek - 1];
        if (!dayName) continue;
        let match = true;
        if (catDiscipline && cls.discipline !== catDiscipline) match = false;
        if (catGym && cls.gym !== catGym) match = false;
        if (catSearch.trim()) {
          const q = catSearch.toLowerCase();
          if (!cls.title.toLowerCase().includes(q) && !cls.discipline.toLowerCase().includes(q) && !disciplineToCategory(cls.discipline).toLowerCase().includes(q) && !cls.gym.toLowerCase().includes(q) && !(cls.location && cls.location.toLowerCase().includes(q)) && !(cls.address && cls.address.toLowerCase().includes(q)) && !(cls.level && cls.level.toLowerCase().includes(q)) && !(cls.subDiscipline && cls.subDiscipline.toLowerCase().includes(q)) && !(cls.instructor && cls.instructor.toLowerCase().includes(q))) match = false;
        }
        if (match) map[dayName].push({ cls, schedule: sched });
      }
    }
    for (const day of DAYS) map[day].sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime));
    return map;
  }, [catalogueClasses, catDiscipline, catGym, catSearch]);

  return {
    catSearch, setCatSearch, catDiscipline, setCatDiscipline, catGym, setCatGym,
    allDisciplines, allGyms, catalogueByDay,
  };
}

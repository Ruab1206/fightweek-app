const db = require('./firestore-admin.cjs');
const COL = 'artifacts/production/public/data/backlog';
const now = new Date().toISOString();

(async () => {
  await db.init();
  const items = await db.listCollection(COL);
  const i = items.find(x => x.number === 917);
  if (!i) { console.log('#917 not found'); return; }

  await db.updateDoc(COL + '/' + i.id, {
    title: 'Add catalogue class to program',
    desc: 'Replace GLOBAL_TEMPLATES with live catalogue. Two entry points: (1) Day drawer — tap [+] on a day, slide-up panel shows catalogue classes for that day with filters. (2) Week catalogue view (desktop only) — toggle shows full 7-day catalogue grid below the program. Program auto-feeds into each new week. Sessions store catalogueClassId.',
    acceptance: [
      '1. Day drawer: tap [+] on a day → slide-up panel with catalogue classes filtered to that day',
      '2. Drawer has discipline chips, gym chips, and search bar with synonym support',
      '3. Favorites shown first, then by gym distance, then alpha',
      '4. Classes already in program are marked with ✓ (not duplicated on tap)',
      '5. Tapping a catalogue card adds it to the program day immediately (toast confirms)',
      '6. "+ Opret egen" button in drawer for custom classes (#1124)',
      '7. Week catalogue view (desktop): toggle "Vis katalog" shows 7-day catalogue grid below program',
      '8. Each catalogue card in week view has [+ Tilføj] button to add to program',
      '9. Sessions store catalogueClassId linking back to catalogue',
      '10. GLOBAL_TEMPLATES deleted from constants.ts',
      '11. New weeks auto-populate from program (no manual "Hent Standard" button)',
      '12. Filters reuse synonym map and chips from CataloguePage',
    ].join('\n'),
    notes: 'Replaces "Rediger standarduge" mode toggle. Program becomes a first-class tab. Mobile: day drawer only. Desktop: day drawer + optional week catalogue view.',
    status: 'doing',
    updatedAt: now,
  });
  console.log('#917 updated and moved to doing');
})();

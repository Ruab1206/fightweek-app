# Fightweek Core Flows

## Flow 1: Create recurring class series

1. Gym/system admin creates an EventSeries of type `class`.
2. The system generates EventOccurrences for a rolling 6-month window, approximately 26 weeks.
3. Occurrences are shown on the gym/public calendar.
4. Fighters can favorite the class series.
5. Fighters can add individual occurrences to their own calendar.

> Note: Older/current implementation may still materialize recurring sessions for 52 weeks. Treat this as current implementation behavior to be refactored later, not the target model.

## Flow 2: Edit recurring class

When editing an occurrence from a series, the user chooses:

1. This event only
2. This and following events
3. All events in the series

Default rule: occurrence-level exceptions are preserved unless the user explicitly chooses to overwrite them.

## Flow 3: Coach creates team event

The coach chooses participation mode:

- None: just show it on the team calendar.
- Open signup: team members can respond from the event.
- Invite only: only selected users can participate.
- Invite with response: selected users are expected to respond.

## Flow 4: Fighter suggests a class to another fighter

The fighter chooses:

- Share: sends/references the class without response tracking.
- Invite: asks the other fighter to join and tracks response.

If Invite is chosen:

1. The inviter has or gets a CalendarEntry for the occurrence.
2. The friend gets an OccurrenceParticipation with status `needs_action`.
3. The friend can respond `accepted`, `tentative` or `declined`.
4. The inviter can be notified when the friend responds.

## Flow 5: Log training

1. Fighter completes or selects a scheduled occurrence.
2. Fighter creates an EventLog.
3. The occurrence is now protected from hard deletion.
4. Later changes to the source series must not remove or corrupt the log.

## Flow 6: Favorite a class

1. Fighter favorites an EventSeries.
2. Favorite makes the class easier to find when scheduling.
3. Favorite does not create a CalendarEntry.
4. Favorite does not imply participation.

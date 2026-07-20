# Fightweek Test Scenarios

## Priority 1: Protect logs and historical data

### Test: logged occurrence cannot be hard-deleted

Given an EventOccurrence exists
And a fighter has created an EventLog for the occurrence
When the source EventSeries is deleted
Then the occurrence still exists
And the EventLog still points to the occurrence
And the title, type, start time, end time and location are still readable

### Test: deleting future series does not remove past logged training

Given a recurring EventSeries has past and future EventOccurrences
And a past occurrence has an EventLog
When the user deletes all future events in the series
Then future non-logged occurrences are cancelled or removed
And the past logged occurrence remains unchanged

## Priority 2: Recurring event edit behavior

### Test: edit this occurrence only

Given a weekly class series exists
When one occurrence description is changed using "this event only"
Then only that occurrence changes
And the occurrence is marked as a series exception
And other occurrences remain unchanged

### Test: edit all events preserves exceptions

Given a weekly class series exists
And one occurrence has an individual changed description
When the series title is changed using "all events in the series"
Then non-exception occurrences receive the new title
And the individually changed occurrence keeps its exception data

### Test: edit this and following events preserves past

Given a weekly class series exists
When the user changes the time from a selected occurrence using "this and following"
Then occurrences before the selected occurrence keep the old time
And selected/future occurrences use the new time
And existing logs remain linked to their original occurrences

## Priority 3: Participation

### Test: coach open signup

Given a team event has participation mode `open_signup`
When a team member marks `accepted`
Then an OccurrenceParticipation is created or updated
And the coach can see the response

### Test: coach invite with response

Given a coach invites selected fighters to an occurrence
When invitations are sent
Then each invited fighter has an OccurrenceParticipation with status `needs_action`

### Test: series participation overridden for one occurrence

Given a fighter accepts a recurring series
When the fighter declines one occurrence
Then the SeriesParticipation remains accepted
And the OccurrenceParticipation for that occurrence is declined

## Priority 4: Fighter-to-fighter suggestion

### Test: share class does not require response

Given a fighter shares a class occurrence with another fighter
When the class is shared
Then no required participation response is created

### Test: invite friend to class tracks response

Given a fighter invites a friend to a class occurrence
When the friend accepts
Then the friend's OccurrenceParticipation status becomes accepted
And the inviter can see or receive the response

## Priority 5: Favorites

### Test: favorite class series

Given a class EventSeries exists
When a fighter favorites it
Then a Favorite is created for the user and series
And no CalendarEntry is created
And no Participation is created

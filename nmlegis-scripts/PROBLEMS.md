
2022-02-08 - Multiple Meetings Per Day
--------------------------------------

[Placeholder. Discussion has been over email and in code comments.]


2022-02-09 - Bill Inconsistencies between calendars
---------------------------------------------------

Two days in a row, HB193 appears in one schedule but not another:

    Date:    Tue, 08 Feb 2022 18:55:13 -0700
    nmlegis-get-calendars: HEC/02-09: bills:
       - HB184 HB193 HB159 HM33 in /Agendas/Standing/hSched020822.pdf
       - HB184 ----- HB159 HM33 in /Agendas/Standing/hSched020922.pdf (*)

    Date:    Wed, 09 Feb 2022 08:55:11 -0700
    nmlegis-get-calendars: HEC/2022-02-09: bills:
       - HB184 ----- HB159 HM33 in /Agendas/Standing/hSched020922.pdf
       - HB184 HB193 HB159 HM33 in /Agendas/Standing/HECageFeb09.22.pdf (*)

As of 2022-02-09T09:20:00 HB193 itself shows:

    Current Location
    HOUSE EDUCATION COMMITTEE

...and the HTML HEC calendar shows it.


2022-02-14 room number not on same line as date/time
----------------------------------------------------

https://nmlegis.gov/Agendas/Standing/SIRCageFeb15.22.pdf

 ____________________________________________________________________
DATE                          TIME                               ROOM
Tuesday, February 15, 2022    10:00 A.M. OR ONE HOUR
                              BEFORE THE FLOOR SESSION             303
____________________________________________________________________
                                                                   ^^^

"303" is not in the line immediately after ROOM, it's two lines down,
so my script doesn't see it.

This should be easy to fix in the bounding-box rewrite.


Cross-check dates?
------------------

Should I cross-check the date string in the agenda, against the URL?

UPDATE: no, nmlegis-view-agenda 2021-01-25 hc has Jan 26-7-8

2023-01-18 garbled pdf
----------------------

A number of PDFs are being published, and they're unreadable.

SOLUTION: looks like I'm screwed:
  https://stackoverflow.com/questions/12184304/extracting-text-from-garbled-pdf

INSERT INTO bills VALUES(1001,YYYY,'HB99','H','B',99,'House Bill 99 Name','blurb for hb99', '[1] HAFC-HAFC- DP [2] PASSED/H (65-1) [1] SFC-SFC- DP [2] PASSED/S (41-0) [1] SGND BY GOV (Jan. 23) Ch. 1.','*');
INSERT INTO bills VALUES(1002,YYYY,'SB123','S','B',123,'Senate Bill 123 Name','blurb for sb123', '[1] HAFC-HAFC- DP [2] PASSED/H (65-1) [1] SFC-SFC- DP [2] PASSED/S (41-0) [1] SGND BY GOV (Jan. 23) Ch. 1.','*');
INSERT INTO bills VALUES(1003,YYYY,'HJR30','H','JR',30,'House Joint Resolution 30 Name','blurb for sb123', '[1] HAFC-HAFC- DP [2] PASSED/H (65-1) [1] SFC-SFC- DP [2] PASSED/S (41-0) [1] SGND BY GOV (Jan. 23) Ch. 1.','*');
INSERT INTO bills VALUES(1004,YYYY,'HM50','H','M',50,'House Memorial 50 Name','blurb for hb50', '[1] HAFC-HAFC- DP [2] PASSED/H (65-1) [1] SFC-SFC- DP [2] PASSED/S (41-0) [1] SGND BY GOV (Jan. 23) Ch. 1.','*');
INSERT INTO bills VALUES(1005,YYYY,'HB22','H','B',22,'House Bill 22 Name','blurb for hb22', '[1] HAFC-HAFC- DP [2] PASSED/H (65-1) [1] SFC-SFC- DP [2] PASSED/S (41-0) [1] SGND BY GOV (Jan. 23) Ch. 1.','*');

/* Tracked only by user 2 on their private tracker */
INSERT INTO bills VALUES(2002,YYYY,'HB202','H','B',202,'House Bill 202 Name','blurb for hb202', '[1] HAFC-HAFC- DP [2] PASSED/H (65-1) [1] SFC-SFC- DP [2] PASSED/S (41-0) [1] SGND BY GOV (Jan. 23) Ch. 1.','*');
INSERT INTO bills VALUES(2003,YYYY,'HB203','H','B',203,'House Bill 203 Name','blurb for hb203', '[1] HAFC-HAFC- DP [2] PASSED/H (65-1) [1] SFC-SFC- DP [2] PASSED/S (41-0) [1] SGND BY GOV (Jan. 23) Ch. 1.','*');
INSERT INTO bills VALUES(2004,YYYY,'HB204','H','B',204,'House Bill 204 Name','blurb for hb204', '[1] HAFC-HAFC- DP [2] PASSED/H (65-1) [1] SFC-SFC- DP [2] PASSED/S (41-0) [1] SGND BY GOV (Jan. 23) Ch. 1.','*');
INSERT INTO bills VALUES(2011,YYYY,'SB201','S','B',201,'Senate Bill 201 Name','blurb for sb201', '[1] HAFC-HAFC- DP [2] PASSED/H (65-1) [1] SFC-SFC- DP [2] PASSED/S (41-0) [1] SGND BY GOV (Jan. 23) Ch. 1.','*');



INSERT INTO users VALUES (1, 'nmlegis-test1@edsantiago.com', 'x', 'Test1First', 'Test1Last', 43, 5, 1);
INSERT INTO users VALUES (2, 'nmlegis-test2@edsantiago.com', 'x', 'Test2First', 'Test2Last', 43, 5, 1);
INSERT INTO users VALUES (3, 'nmlegis-test3@edsantiago.com', 'x', 'Test3First', 'Test3Last', 43, 5, 1);
INSERT INTO users VALUES (4, 'nmlegis-test4@edsantiago.com', 'x', 'Test4First', 'Test4Last', 43, 5, 1);
INSERT INTO users VALUES (5, 'nmlegis-test5@edsantiago.com', 'x', 'Test5First', 'Test5Last', 43, 5, 1);
INSERT INTO users VALUES (6, 'nmlegis-test6@edsantiago.com', 'x', 'Test6First', 'Test6Last', 43, 5, 1);

INSERT INTO trackers VALUES(11, 't1', 'Tracker 1', 1,0,'');
INSERT INTO tracked  VALUES(11, 1001, 'Category 1-1', 0);
INSERT INTO tracked  VALUES(11, 1002, 'Category 1-2', 0);


INSERT INTO trackers VALUES(12, 't2', 'Tracker 2 with no subscribers', 1,0,'');

INSERT INTO trackers VALUES(13, 't3', 'Tracker 3 with many subscribers but no bills', 1,0,'');
INSERT INTO tracker_access VALUES (13, 1, '', 1);
INSERT INTO tracker_access VALUES (13, 2, '', 1);
INSERT INTO tracker_access VALUES (13, 3, '', 1);
INSERT INTO tracker_access VALUES (13, 4, '', 1);
INSERT INTO tracker_access VALUES (13, 5, '', 1);

INSERT INTO trackers VALUES(14, 't4', 'Tracker 4 with many subscribers and many bills', 1,0,'');
INSERT INTO tracker_access VALUES (14, 1, '', 1);
INSERT INTO tracker_access VALUES (14, 2, '', 1);
INSERT INTO tracker_access VALUES (14, 3, '', 1);
INSERT INTO tracker_access VALUES (14, 4, '', 1);
INSERT INTO tracker_access VALUES (14, 5, '', 1);
INSERT INTO tracked  VALUES(14, 1001, 'Category 4-1', 0);
INSERT INTO tracked  VALUES(14, 1002, 'Category 4-2', 0);
INSERT INTO tracked  VALUES(14, 1003, 'Category 4-3', 0);
INSERT INTO tracked  VALUES(14, 1004, 'Category 4-4', 0);
INSERT INTO tracked  VALUES(14, 1005, 'Category 4-5', 0);

INSERT INTO trackers VALUES(21, 't-u1', 'User 1 tracker', 1,0,'');

INSERT INTO trackers VALUES(22, 't-u2', 'User 2 tracker', 2,0,'');
INSERT INTO tracked  VALUES(22, 1001, 'TU2 House Bills', 0);
INSERT INTO tracked  VALUES(22, 2002, 'TU2 House Bills', 0);
INSERT INTO tracked  VALUES(22, 2003, 'TU2 House Bills', 0);
INSERT INTO tracked  VALUES(22, 2004, 'TU2 House Bills', 0);
INSERT INTO tracked  VALUES(22, 2011, 'TU2 Senate Bills', 0);

/* Nothing in user 3's tracker */
INSERT INTO trackers VALUES(23, 't-u3', 'User 3 tracker', 3,0,'');

/* Identical to Tracker 4, so, Tracker 4 shouldn't even appear */
INSERT INTO trackers VALUES(24, 't-u4', 'User 4 tracker', 4,0,'');
INSERT INTO tracked  VALUES(24, 1001, '', 0);
INSERT INTO tracked  VALUES(24, 1002, '', 0);
INSERT INTO tracked  VALUES(24, 1003, '', 0);
INSERT INTO tracked  VALUES(24, 1004, '', 0);
INSERT INTO tracked  VALUES(24, 1005, '', 0);


INSERT INTO trackers VALUES(25, 't-u5', 'User 5 tracker', 5,0,'');

/* User 6 isn't even subscribed to tracker 4, nor any trackers. */
INSERT INTO trackers VALUES(26, 't-u6', 'User 5 tracker', 6,0,'');

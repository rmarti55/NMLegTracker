# -*- perl -*-

use Mojo::Base -strict;

use utf8;
use open qw( :encoding(UTF-8) :std );

use File::Temp          qw(tempfile);
use Test::More;
use Test::Mojo;
use Time::Piece;

###############################################################################
# BEGIN create fixture db

# FIXME: refactor this

my (undef, $dbfile) = tempfile("NMLegis-UI-mojo.XXXXXX", TMPDIR => 1, SUFFIX => ".sqlite", UNLINK => !$ENV{DEBUG});
open my $fh_sqlite, '|-', 'sqlite3', $dbfile
    or die "Could not fork pipe to sqlite: $!";
print { $fh_sqlite } "PRAGMA sqlite_unicode = 1;\n";
open my $fh_schema, '<', 'db/schema.sql'
    or die "Could not read schema.sql: $!";
while (my $line = <$fh_schema>) {
    print { $fh_sqlite } $line;
}
close $fh_schema;

my $YYYY = localtime->year;
while (my $line = <DATA>) {
    $line =~ s/YYYY/$YYYY/g;
    print { $fh_sqlite } $line;
}
close $fh_sqlite
    or die "error running sqlite3: $!";

$ENV{NMLEGIS_UI_TEST_DB} = $dbfile;

# END   create fixture db
###############################################################################


my $t = Test::Mojo->new('NMLegis::UI');
$t->get_ok('/')->status_is(200)
  ->content_like(qr/labor of love/i)
  ->content_like(qr/Committees/)
  ;

$t->get_ok('/committees')
  ->status_is(200)
  ->content_like(qr/Senate.*Committees&#39; Committee/)
  ->content_like(qr/Christine Chandler/)
  ->content_unlike(qr/Jaramillo/)
  ;

$t->get_ok('/committees/SRC')
  ->status_is(200)
  ->content_like(qr/SRC - Senate Rules/)
  ->content_like(qr/Leo Jaramillo/)
  ->content_unlike(qr/Chandler/)
  ->content_like(qr/2112-01-01.*SB353.*This Is Not A Vote/ms)
  ;

# Test redirects
$t->get_ok('/committees/src')
    ->status_is(302)
    ->header_is(location => '/committees/SRC');
$t->get_ok('/committees/src.html')
    ->status_is(302)
    ->header_is(location => '/committees/SRC');
$t->get_ok('/legislators/hchan')
    ->status_is(302)
    ->header_is(location => '/legislators/HCHAN');
$t->get_ok('/legislators/Hchan.html')
    ->status_is(302)
    ->header_is(location => '/legislators/HCHAN');

# Test search
$t->get_ok('/search?q=chandler')
    ->status_is(302)
    ->header_is(location => '/legislators/HCHAN')
    ;

$t->get_ok('/search?q=hchan')
    ->status_is(302)
    ->header_is(location => '/legislators/HCHAN')
    ;

$t->get_ok('/search?q=src')
    ->status_is(302)
    ->header_is(location => '/committees/SRC')
    ;

$t->get_ok('/search?q=search%20rescue')
    ->status_is(302)
    ->header_is(location => '/bills/SB353')
    ;

$t->get_ok('/search?q=blurb')
    ->status_is(200)
    ->content_like(qr/search terms appear in bill blurb, not title/)
    ->content_like(qr/ICKY ALL CAPS/)
    ->content_like(qr/Feed Bill/)
    ->content_like(qr/Rescue Emergency Responses/)
    ->content_unlike(qr/slartibartfast/i)       # FIXME: some day, include blurb
    ;

done_testing();

__DATA__

-- bills
INSERT INTO bills VALUES(1,YYYY,'HB1','H','B',1,'Feed Bill','blurb for hb1', '[1] HAFC-HAFC- DP [2] PASSED/H (65-1) [1] SFC-SFC- DP [2] PASSED/S (41-0) [1] SGND BY GOV (Jan. 23) Ch. 1.','*');
INSERT INTO bills VALUES(780,YYYY,'SB353','S','B',353,'Search & Rescue Emergency Responses','A BILL, blah blah, Slartibartfast appears only in blurb, not in any title', '[6] SIRC/STBTC-SIRC','');

-- legislators
INSERT INTO legislators VALUES(10,'H','HMARJ','Javier','Martínez',11,'Bernalillo','D','Speaker Of The House','Representative since 2015','Attorney','104','javier.martinez@nmlegis.gov','','986-4782','','','','','','House Session Secretary List');
INSERT INTO legislators VALUES(42,'H','HCHAN','Christine','Chandler',43,'Los Alamos, Sandoval & Santa Fe','D','','Representative since 2019','Lawyer','308A','christine.chandler@nmlegis.gov','','986-4411','','Laurel Minter','laurel.minter@nmlegis.gov','505-946-5643','','House Session Secretary List');
INSERT INTO legislators VALUES(74,'S','SJARA','Leo','Jaramillo',5,'Los Alamos, Rio Arriba, Sandoval & Santa Fe','D','','Senator since 2021','Staff Operations Manager','300D','leo.jaramillo@nmlegis.gov','','986-4260','','Briana Salazar','briana.salazar@nmlegis.gov','505-946-5555','','SD5.Secr@nmlegis.gov');
INSERT INTO legislators VALUES(105,'S','SSTEI','Jeff','Steinborn',36,'Doña Ana','D','','Representative from 2007- 2010 and 2013-2016; Senator since 2017','Land Conservation','218A','jeff.steinborn@nmlegis.gov','','986-4862','','','','','','SD36.secr@nmlegis.gov');
INSERT INTO legislators VALUES(79,'S','SDUHI','Katy','Duhigg',10,'Bernalillo','D','','Senator since 2021','Attorney','320A','katy.duhigg@nmlegis.gov','','986-4270','','Colin Harris','colin.harris@nmlegis.gov','505-946-5560','','SD10.secr@nmlegis.gov');
INSERT INTO legislators VALUES(103,'S','STOWJ','James G.','Townsend',34,'Eddy & Otero','R','','Representative from 2015-2024; Senator from 2025','Ret./Dir. Holly Energy','415C','townsend@pvtn.net','','986-4366','','','','','','SD34.secr@nmlegis.gov');
INSERT INTO legislators VALUES(84,'S','SBERG','Heather','Berghmans',15,'Bernalillo','D','','Senator since 2025','','416C','heather.berghmans@nmlegis.gov','','986-4726','','','','','','SD15.secr@nmlegis.gov');
INSERT INTO legislators VALUES(86,'S','SSTEW','Mimi','Stewart',17,'Bernalillo','D','President Pro Tempore','Representative from 1995-2014; Senator since 2015','Retired Educator','105A','mimi.stewart@nmlegis.gov','','986-4734','(505) 986-4733','','','','','SD17.secr@nmlegis.gov');

-- one sponsor for each bill

INSERT INTO sponsors VALUES(1,46,1);
INSERT INTO sponsors VALUES(780,105,1);

-- committees
INSERT INTO committees VALUES(9,'H','HJC','House Judiciary','309','Monday, Wednesday & Friday','1:30 PM');
INSERT INTO committees VALUES(21,'S','SRC','Senate Rules','321','Monday, Wednesday & Friday','9:00 AM');
INSERT INTO committees VALUES(23,'S','SXCC','Senate Committees'' Committee','[could not determine room]','At call of chair','');

INSERT INTO committee_members VALUES(9,42,'Chair');
INSERT INTO committee_members VALUES(21,79,'Chair');
INSERT INTO committee_members VALUES(21,74,'Vice Chair');
INSERT INTO committee_members VALUES(21,103,'Ranking Member');
INSERT INTO committee_members VALUES(21,84,'Member');
INSERT INTO committee_members VALUES(23,86,'Chair');

INSERT INTO committee_reports VALUES (1, 21, 780, 1, '2112-01-01', 'http://HBXYZ-REPORT.HTML', '',YYYY);
INSERT INTO committee_report_votes VALUES (1, 103, 'This Is Not A Vote');

# -*- perl -*-

use v5.30;
use utf8;
use open qw( :encoding(UTF-8) :std );

use Mojo::Base -strict;

use Crypt::PBKDF2;
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

# Force a random password
my $pw = join('', map { ('a'..'z','A'..'Z','0'..'9')[rand 62] } 0..20);
my $pwhash = Crypt::PBKDF2->new->generate($pw);
system('sqlite3', $dbfile, "UPDATE users SET password='$pwhash' WHERE id=1;");

$ENV{NMLEGIS_UI_TEST_DB} = $dbfile;

# END   create fixture db
###############################################################################


my $t = Test::Mojo->new('NMLegis::UI');

# Not logged in
$t->get_ok('/bills')->status_is(200)
    ->content_like(qr/Log In/i)
    ->content_like(qr/Committees/)
    ->content_like(qr/Legislators/)
    ->content_like(qr/Feed Bill/)
    ->content_like(qr/Search &amp; Rescue Emergency Responses/)
    ->content_unlike(qr/All Legislators/)
    ->content_unlike(qr/Update Bill Status/)
    ->content_unlike(qr/SAR Tracker/)
    ->content_unlike(qr/mylegislator.*Chandler/ms)
    ;

$t->get_ok('/legislators')->status_is(200)
    ->content_like(qr/Log In/i)
    ->content_like(qr/Committees/)
    ->content_like(qr/Szczepanski/)
    ->content_unlike(qr/mylegislator.*Chandler/ms)
    ;

# Trackers. None of the private ones should be accessible
$t->get_ok('/trackers/pnonexistent')
    ->status_is(302)
    ;
$t->get_ok('/trackers/pnone')
    ->status_is(302)
    ;
$t->get_ok('/trackers/pro')
    ->status_is(302)
    ;
$t->get_ok('/trackers/prw')
    ->status_is(302)
    ;


$t->post_ok('/login' => form => { email => 'nmlegis-test@edsantiago.com', password => $pw, referer => '/legislators' })
    ->status_is(302)
    ->header_is(location => '/legislators')
    ;

# Logged in, now we see trackers and settings
$t->get_ok('/bills')
    ->status_is(200)
    ->content_unlike(qr/Log In/i)
    ->content_like(qr/Committees/)
    ->content_like(qr/All Legislators/)
    ->content_like(qr/Rep\. Christine Chandler/)  # under Legislators menu
    ->content_like(qr/Sen\. Leo Jaramillo/)
    ->content_like(qr/Feed Bill/)
    ->content_like(qr/Search &amp; Rescue Emergency Responses/)
    ->content_unlike(qr/Update Bill Status/)
    ->content_like(qr/My Settings/)
    ->content_like(qr/SAR Tracker/)
    ->content_like(qr/Medical.*mylegislator.*Chandler/ms)
    ;

$t->get_ok('/trackers/SAR')
    ->status_is(200)
    ->content_like(qr/SAR-Category/)
    ->content_unlike(qr/Feed Bill/)
    ->content_like(qr/Search &amp; Rescue Emergency Responses/)
    ->content_like(qr/Update Bill Status/)
    ;

# Tracker permissions
$t->get_ok('/trackers/pnonexistent')
    ->status_is(302)
    ;
$t->get_ok('/trackers/pnone')
    ->status_is(302)
    ;
$t->get_ok('/trackers/pro')
    ->status_is(200)
    ->content_like(qr/Private with read-only access/)
    ;
$t->get_ok('/trackers/prw')
    ->status_is(200)
    ->content_like(qr/Private with read\/write access/)
    ;

#
# Log out, register, and log in again
#
$t->get_ok('/logout')
    ->status_is(302)
    ->header_is(location => '/')
    ;

$t->get_ok('/register')
    ->status_is(200)
    ->content_unlike(qr/Settings/)
    ->content_like(qr/Log In/)
    ;

my %newuser = (
    email     => 'nmlegis-newuser@edsantiago.com',
    password  => $pw,
    firstname => 'Myfirstname',
    lastname  => 'Mylastname',
    hdistrict => 10,
    sdistrict =>  6,
);

for my $k (sort keys %newuser) {
    $t->tx->result->dom->find("input #$k");
}

$t->post_ok('/register' => form => \%newuser)
    ->status_is(200)
    ;

done_testing();

__DATA__

-- bills
INSERT INTO bills VALUES(1,YYYY,'HB1','H','B',1,'Feed Bill','blurb for feed bill nom nom', '[1] HAFC-HAFC- DP [2] PASSED/H (65-1) [1] SFC-SFC- DP [2] PASSED/S (41-0) [1] SGND BY GOV (Jan. 23) Ch. 1.','*');
INSERT INTO bills VALUES(11,YYYY,'HB11','H','B',11,'Paid Family & Medical Leave Act','blurb for hb11', 'HPREF [1] HHHC/HCEDC-HHHC [2] DP-HCEDC','');
INSERT INTO bills VALUES(780,YYYY,'SB353','S','B',353,'Search & Rescue Emergency Responses','blurb for sb353', '[6] SIRC/STBTC-SIRC','');


INSERT INTO legislators VALUES(42,'H','HCHAN','Christine','Chandler',43,'Los Alamos, Sandoval & Santa Fe','D','','Representative since 2019','Lawyer','308A','christine.chandler@nmlegis.gov','','986-4411','','Laurel Minter','laurel.minter@nmlegis.gov','505-946-5643','','House Session Secretary List');
INSERT INTO legislators VALUES(46,'H','HSZCZ','Reena','Szczepanski',47,'Santa Fe','D','Majority Floor Leader','Representative since 2023','','134B','reena.szczepanski@nmlegis.gov','(505) 986-4780','986-4777','','Ashley Watson','ashley.watson@nmlegis.gov','505-946-5647','','House Session Secretary List');
INSERT INTO legislators VALUES(74,'S','SJARA','Leo','Jaramillo',5,'Los Alamos, Rio Arriba, Sandoval & Santa Fe','D','','Senator since 2021','Staff Operations Manager','300D','leo.jaramillo@nmlegis.gov','','986-4260','','Briana Salazar','briana.salazar@nmlegis.gov','505-946-5555','','SD5.Secr@nmlegis.gov');
INSERT INTO legislators VALUES(105,'S','SSTEI','Jeff','Steinborn',36,'Doña Ana','D','','Representative from 2007- 2010 and 2013-2016; Senator since 2017','Land Conservation','218A','jeff.steinborn@nmlegis.gov','','986-4862','','','','','','SD36.secr@nmlegis.gov');

/* Not really used, but needed temporarily 2025-03-04 because of scheduling */
INSERT INTO committees VALUES(1, 'S', 'STBTC', 'Blah blah', '', '', '');

INSERT INTO sponsors VALUES(1,46,1);
INSERT INTO sponsors VALUES(11,42,1);
INSERT INTO sponsors VALUES(780,105,1);

INSERT INTO users VALUES (1, 'nmlegis-test@edsantiago.com', '{X-PBKDF2}HMACSHA1:AAAD6A:zQGNgA==:phVx2PJBV7Wd4dAEMF5mgWteBCc=', 'MyFirstName', 'My Last Name', 43, 5, 1);
INSERT INTO users VALUES (2, 'nonesuch@nowhere', '*', 'MyFirstName', 'My Last Name', null, null, 1);

INSERT INTO trackers VALUES(90,'SAR',   'SAR Tracker',1,0,'');
INSERT INTO trackers VALUES(91,'Pnone', 'Private with no access',2,0,'');
INSERT INTO trackers VALUES(92,'Pro',   'Private with read-only access',2,0,'');
INSERT INTO trackers VALUES(93,'Prw',   'Private with read/write access',2,0,'');

INSERT INTO tracked VALUES (90, 780, 'SAR-Category', 0);

INSERT INTO tracker_access VALUES (92, 1, 'r', 0);
INSERT INTO tracker_access VALUES (93, 1, 'w', 0);

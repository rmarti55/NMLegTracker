#!/usr/bin/perl

use v5.14;
use utf8;
use open qw( :encoding(UTF-8) :std );

use Test::More;
use Test::Differences;

my @tests;
my $section;
my $context = '';
while (my $line = <DATA>) {
    chomp $line;
    $line =~ s/\s*#.*$//;
    next unless $line;

    if ($line =~ /^=\s+(.*)/) {
        $section = $1;
        $context = '';
    }
    elsif ($line =~ /^"(.*)"$/) {
        push @tests, [ $section, $1, [], [] ];
        $context = '<';
    }
    elsif ($line =~ s!^<!!) {
        push @tests, [ $section, '', [], [] ]  if $context ne '<';
        push @{$tests[-1][2]}, $line;
        $context = '<';
    }
    elsif ($line =~ s!^>!!) {
        push @{$tests[-1][3]}, $line;
        $context = '>';
    }
    else {
        die "Cannot grok test line '$line'\n";
    }
}

plan tests => 1 + @tests;

require_ok "nmlegis-get-calendars";

for my $t (@tests) {
    my ($section, $name, $input, $expect) = @$t;

    my $helper = __PACKAGE__->can("test_$section")
        or die "No test helper for '$section'";

    $helper->($input, $expect, $name);
}



sub test_datetime {
    my $input  = shift;
    my $expect = shift;
    my $name   = shift || "@$input";
    my %keys;

    my $retval = 0;
    for my $line (@$input) {
        my $x = ESM::NMLegisCalendars::parse_date_time($line, \%keys);
        $retval ||= $x;
    }

    # parse_date_time may set internal state variables in the href
    delete $keys{$_} for grep { /^_/ } keys %keys;

    if (@$expect) {
        if ($retval != 1) {
            fail "parse_date_time($name) - did not parse!";
        }
        else {
            my @expect = split(' ', $expect->[0], 3);
            my %expect = (datetime => $expect[0],
                          room     => $expect[1],
                          time     => $expect[2],
                      );

            # Special case for lines where we can't find a time
            if ($expect{datetime} =~ /^\d+-\d+-\d+$/) {
                $expect{date} = delete($expect{datetime});
            }

            else {
                # The usual case: line includes date and time
                delete $keys{date};         # No point in checking this
            }

            # FIXME
            if (! $expect{time}) {
                delete $keys{time};
                delete $expect{time};
            }
            # FIXME: 2024-01-18: I must've changed something that sets this?
            delete $keys{bills};

            eq_or_diff \%keys, \%expect, "parse_date_time($name)";
        }
    }
    else {
        is $retval, 0, "parse_date_time($name) does not parse (expected)";
    }
}


sub test_bills {
    my $input  = shift;
    my $expect = shift;
    my $name   = shift || "@$input";
    my %keys;

    my $retval = 0;
    for my $line (@$input) {
        my $x = ESM::NMLegisCalendars::parse_bill_entry($line, \%keys);
        $retval ||= $x;
    }

    my $actual = join(' ', @{$keys{bills}});
    (my $exp = $expect->[0]) =~ s/^\s*//;
    is $actual, $exp, "parse_bill_entry($name)";
}


sub test_bills_diff {
    my $input  = shift;
    my $expect = shift;
    my $name   = shift || "@$input";
    my %keys;

    my @a1 = split(' ', $input->[0]);
    my @a2 = split(' ', $input->[1]);
    my @actual = ESM::NMLegisCalendars::bills_diff(\@a1, \@a2);
    s/^ //  for @$expect;          # trim one leading space

    eq_or_diff \@actual, $expect, "bills_diff($name)";
}

__END__

= datetime


# FIXME FIXME FIXME: add a test name provision
"simple, lower-case a.m."
<Monday, February 7, 2022 - 8:30 a.m. - Room 315 - Zoom
>2022-02-07T08:30:00    315  8:30 AM

"simple, upper-case AM with no dots"
<Monday, February 7, 2022 - 8:30 AM - Room 315 - Zoom
>2022-02-07T08:30:00  315   8:30 AM

"simple, 12:00 pm"
<Saturday, February 5, 2022 - 12:00 pm - Room 307 - Zoom
>2022-02-05T12:00:00  307  12:00 PM

"with parenthesized 'or'"
<Tuesday, February 8, 2022 - 1:30 p.m.  (or 15 minutes following the floor session) - Room 317 - Zoom
>2022-02-08T13:30:00  317  1:30 PM (or 15 minutes following the floor session)

"unparenthesized 'or'"
<Tuesday, February 8, 2022 - 1:30 p.m. or 15 minutes after floor session - Room 315 - Zoom
>2022-02-08T13:30:00  315 1:30 PM or 15 minutes after floor session

"Call of the chair, no time"
< Monday, February 7, 2022 - Call of the chair after the floor session - Room 307 - Zoom
>2022-02-07T00:00:00 307 Call of the chair after the floor session

"Time, with call of chair"
< Tuesday, February 8, 2022 - 1:30 pm or at the call of the Chair - Room 307 - Zoom
>2022-02-08T13:30:00  307  1:30 PM or at the call of the Chair

"with or 1/2"
<   Monday, February 7, 2022 - 1:30 p.m. or 1/2 hr after session - Room 311
>2022-02-07T13:30:00  311 1:30 PM or 1/2 hr after session

# Seen in sSched020722.pdf / SFC (first page).
# 2022-02-14 per request from Akkana, never override times! Pick the earliest!
# That way someone trying to Zoom will be early, not late
"Good golly, multiple times"
# FIXME FIXME FIXME! How do we handle this???
#
<         Monday, February 7, 2022 - 9:30 a.m. and 1:30 p.m. - Room 326 and 322
<                                   or 1/2 hr. after session
<
<9:30 a.m.
<
<  Subcommittee on Appropriations in the General Appropriations Act       Rm. 322
<  Subcommittee on Language Adjustments to the General Appropriations Act Rm. 326
<
<1:30 p.m. - Room 322
#
#      SB     34    THREAT OF SHOOTING                                      (BRANDT)
#      SB    159    LEGISLATIVE RETIREMENT CHANGES                           (INGLE)
#
# source: gov_Agendas_Standing_sSched020722.pdf
#
>2022-02-07T09:30:00  322

# Argh.
"Abbreviations"
<Wed., Feb. 9, 2022 1:30 pm or 1/2 hr after floor session           311
>2022-02-09T13:30:00  311 1:30 PM or 1/2 hr after floor session

# 2022-02-09 seen in HCPACageFeb10.22.pdf
"split into two lines"
<Thursday, February 10, 2022    - 1:30 p.m. (or 15 minutes following the floor
<session) - Room 317 - Zoom
>2022-02-10T13:30:00   317  1:30 PM (or 15 minutes following the floor session)

# 2022-02-10 seen in SFCageFeb10.22.pdf
"unicode 1/2 in the time-only line"
<                          Revised AGENDA #2
< ____________________________________________________________________
<DATE                          TIME                               ROOM
<Thursday, February 10, 2022 1:30 P.M. or 1/2 hour after           322
<                              Floor Session
<                              or Call of Chair
<____________________________________________________________________
<
<
<  1:30 P.M. or ½ hour after Floor Session
>2022-02-10T13:30:00  322  1:30 PM or 1/2 hour after

# 2022-02-10 seen in HAFCageFeb10.22.pdf
"at the call of the chair"
<Thursday, February 10, 2022    - At the call of Chair-Room 307-Zoom -
>2022-02-10T00:00:00 307  At the call of Chair

# 2022-02-10 seen in SHPACageFeb11.22.pdf
"time without am/pm"
<Friday, February 11, 2022     1:30 or 1/2 hr after floor session   311
>2022-02-11T13:30:00    311   1:30 PM or 1/2 hr after floor session

# 2022-02-11 seen in SIRCageFeb11.22.pdf
"Room number in heading line"
<DATE                          TIME                      ROOM 303
<Friday, February 11, 2022     1:30 p.m. or ½ hr. after session
<                              or Call of the Chair
>2022-02-11T13:30:00   303  1:30 PM or ½ hr. after session or Call of the Chair

# -----------------------------------------------------------------------------

= bills

"simple list of bills"
<      * HB 127       STORAGE OF CERTAIN RADIOACTIVE WASTE     (...
<       *HB   112/a   SUBSTANCE USE DISORDER PGMS & CLINICS    (...
<     CS/HB   101     NM REFORESTATION CENTER ACT              (...
<      C/SB     7     STATE EMPLOYEE MINIMUM WAGE              (...
<     *C/SB 12 AG OFFICE FOR MISSING INDIGENOUS PERSONS (PINTO)
< CS/CS/ SB 14 /a ENACTING THE CLEAN FUEL STANDARD ACT
> HB127 HB112 HB101 SB7 SB12 SB14

# From https://nmlegis.gov/Agendas/Standing/sSched021222.pdf
"multiple bills in one line"
<    C/HB 2 & 3 GENERAL APPROPRIATION ACT OF 2022 (LUNDSTROM)
>HB2 HB3


# -----------------------------------------------------------------------------

= bills_diff

"identical, one bill"
< HB123
< HB123

"identical, multiple bills"
< HB123 HB345 HB789
< HB123 HB345 HB789

"nothing in common, from HAFC/02-07"
< HB227
< HB116 HB119 HB57 HB96 HB112 HB97 HB114 HB103 HB109 HB41 HB124 HB104 HB92
> HB227 ----- ----- ---- ---- ----- ---- ----- ----- ----- ---- ----- ----- ----
> ----- HB116 HB119 HB57 HB96 HB112 HB97 HB114 HB103 HB109 HB41 HB124 HB104 HB92

"added at end, from HLVMC/02-08"
< HB73 HB106 HB168
< HB73 HB106 HB168 HB110
> HB73 HB106 HB168 -----
> HB73 HB106 HB168 HB110

"added at end, from HTPWC/02-08"
< HB183
< HB183 HM47
> HB183 ----
> HB183 HM47

"Fake 1, direction 1"
< HM47
< HB183 HM47
> ----- HM47
> HB183 HM47

"Fake 1, direction 2"
< HB183 HM47
< HM47
> HB183 HM47
> ----- HM47

"Fake 2, direction 1"
< HM47
< HB183 HM47 HB123
> ----- HM47 -----
> HB183 HM47 HB123

"Fake 2, direction 2"
< HB183 HM47 HB123
< HM47
> HB183 HM47 HB123
> ----- HM47 -----

"two removed, various places, from SFC/02-07"
< SB48 SB34 SB159 SB2 SB36 SB7 SB125
< SB34 SB159 SB2 SB36 SB125
> SB48 SB34 SB159 SB2 SB36 SB7 SB125
> ---- SB34 SB159 SB2 SB36 --- SB125

"one bill removed, one added, same spot, from STBTC/02-08"
< SB106 SB170 SB158 SB184 SB186 SB193 SB207
< SB106 SB170 SB69 SB184 SB186 SB193 SB207
> SB106 SB170 SB158 ---- SB184 SB186 SB193 SB207
> SB106 SB170 ----- SB69 SB184 SB186 SB193 SB207

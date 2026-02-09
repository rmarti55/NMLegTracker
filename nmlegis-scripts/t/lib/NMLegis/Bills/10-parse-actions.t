#!/usr/bin/perl
#
# tests for NMLegis::Bills::_parse_actions
#

use v5.14;
use warnings;
use strict;

use utf8;
use open qw( :encoding(UTF-8) :std );

use Test::More;
use Test::Differences;

my $n_expect = 0;
my @tests;
while (my $line = <DATA>) {
    chomp $line;
    $line =~ s/#.*$//;
    next if $line =~ /^\s*$/;

    if ($line =~ s/^=\s+//) {
        push @tests, { action => $line, expect => [ ['actions', $line] ] };
        ++$n_expect;
    }
    elsif ($line =~ /^>\s+(\w+)\s+=>\s+(.*)/) {
        push @{$tests[-1]{expect}}, [ $1, $2 ];
        ++$n_expect;
    }
    else {
        die "Internal error: cannot grok '$line'";
    }
}

plan tests => 2 + @tests + $n_expect;
use_ok "NMLegis";
use_ok "NMLegis::Bills";

for my $t (@tests) {
    my $name = $t->{action};

    my $parsed = NMLegis::Bills::_parse_actions($name);
    # FIXME: check for errors?

    for my $tuple (@{$t->{expect}}) {
        my ($k, $expect) = @$tuple;

        my $actual = delete $parsed->{$k};
        if (ref($actual)) {
            $actual = flatten($actual);
        }
        eq_or_diff $actual, $expect, "$name: $k";
    }

    my @leftover_keys = sort keys %$parsed;
    eq_or_diff \@leftover_keys, [], "$name: unchecked fields";
}

sub flatten {
    my $ref = shift;

    return $ref if ! ref($ref);

    if (ref($ref) eq 'ARRAY') {
        return flatten_list($ref);
    }
    elsif (ref($ref) eq 'HASH') {
        return flatten_hash($ref);
    }
    else {
        die "Internal error, unknown ref";
    }
}

sub flatten_list {
    my $aref = shift;
    return '[' . join(' ', map { flatten($_) } @$aref) . ']';
}

sub flatten_hash {
    my $href = shift;
    return '{' . join(", ", map { "$_=" . flatten($href->{$_}) } sort keys %$href) . '}';
}

__DATA__

= HPREF [2] HCEDC/HJC-HCEDC
> refer   => [HCEDC HJC]
> cur     => HCEDC
> history => [[0 prefile H] [2 referred HCEDC/HJC] [2 sent HCEDC]]

= HAFC-HAFC
> refer   => [HAFC]
> cur     => HAFC
> history => [[0 referred HAFC] [0 sent HAFC]]

= HCEDC/HAFC-HCEDC
> refer   => [HCEDC HAFC]
> cur     => HCEDC
> history => [[0 referred HCEDC/HAFC] [0 sent HCEDC]]

= SCONC/SJC-SCONC [4] DP-SJC
> refer   => [SCONC SJC]
> passed  => [[4 SCONC with Do Pass recommendation]]
> cur     => SJC
> history => [[0 referred SCONC/SJC] [0 sent SCONC] [4 passed SCONC DP] [4 sent SJC]]

# test /a (amendment)
= [2] SRC/SJC-SRC [5] DP/a-SJC
> refer   => [SRC SJC]
> passed  => [[5 SRC with Do Pass, as amended]]
> cur     => SJC
> history => [[2 referred SRC/SJC] [2 sent SRC] [5 passed SRC DP/a] [5 sent SJC]]

# T = Speaker's Table
= HPREF [2] HTPWC/HTRC-HTPWC [3] DP/a-HTRC [4] DP-T
> refer   => [HTPWC HTRC]
> passed  => [[3 HTPWC with Do Pass, as amended] [4 HTRC with Do Pass recommendation]]
> cur     => Speaker's Table
> history => [[0 prefile H] [2 referred HTPWC/HTRC] [2 sent HTPWC] [3 passed HTPWC DP/a] [3 sent HTRC] [4 passed HTRC DP] [4 sent Speaker's Table]]

# Different T
= [2] HENRC/HAFC-HENRC [3] DP/a-HAFC [4] w/drn-T
> refer   => [HENRC HAFC]
> passed  => [[3 HENRC with Do Pass, as amended]]
> cur     => Speaker's Table
> history => [[2 referred HENRC/HAFC] [2 sent HENRC] [3 passed HENRC DP/a] [3 sent HAFC] [4 withdrawn] [4 on Speaker's Table]]

# Triple referral
= [2] STBTC/SJC/SFC-STBTC
> refer   => [STBTC SJC SFC]
> cur     => STBTC
> history => [[2 referred STBTC/SJC/SFC] [2 sent STBTC]]

= SCONC/SJC-SCONC [4] DNP-CS/DP-SJC
> refer   => [SCONC SJC]
> passed  => [[4 SCONC with Committee Substitution]]
> cur     => SJC
> history => [[0 referred SCONC/SJC] [0 sent SCONC] [4 passed SCONC DNP-CS/DP] [4 sent SJC]]

# Change in referrals?
= HENRC/HAFC-HENRC- HHHC/HJC-HHHC
> refer   => [HHHC HJC]
> cur     => HHHC
> history => [[0 referred HENRC/HAFC] [0 sent HENRC] [0 referred HHHC/HJC] [0 sent HHHC]]

= [4] nt prntd-nt ref com
> cur     => limbo
> history => [[4 nt prntd] [4 nt ref com]]

= [4] nt prntd-nt ref com-tbld
> tabled  => 1
> history => [[4 nt prntd] [4 nt ref com] [4 tabled]]

= HPREF [2] HGEIC/HTPWC-HGEIC [3] w/o rec-HTPWC
> cur     => HTPWC
> refer   => [HGEIC HTPWC]
> passed  => [[3 HGEIC without recommendation]]
> history => [[0 prefile H] [2 referred HGEIC/HTPWC] [2 sent HGEIC] [3 passed HGEIC w/o rec]]

# "w/drn" = withdrawn
= [2] nt prntd-nt ref com-tbld- w/drn - PASSED/H (70-0).
> passed  => [[2 House 70-0]]
> history => [[2 nt prntd] [2 nt ref com] [2 tabled] [2 withdrawn] [2 passed House 70-0]]

= [4] nt prntd-nt ref com- w/drn - PASSED/S (43-0) [5] SGND.
> cur     => signed
> passed  => [[4 Senate 43-0] [5 signed SGND.]]
> history => [[4 nt prntd] [4 nt ref com] [4 withdrawn] [4 passed Senate 43-0] [5 signed SGND.]]
> signed  => {}

# 2023-02-16 HB95: "re-referred to"
= HPREF [2] HGEIC/HENRC-HGEIC [3] DP-HENRC [4] DP [8] re-referred to HENRC- HENRC-
> cur     => HENRC
> refer   => [HENRC]
> passed  => [[3 HGEIC with Do Pass recommendation] [4 HENRC with Do Pass recommendation]]
> history => [[0 prefile H] [2 referred HGEIC/HENRC] [2 sent HGEIC] [3 passed HGEIC DP] [3 sent HENRC] [4 passed HENRC DP] [8 re-referred HENRC] [8 HENRC]]

# 2023-02-20 another ref thing
= [8] SEC/SJC-SEC- w/o rec-SJC- w/drn - ref SEC/SFC-SFC
> cur     => SFC
> refer   => [SEC SFC]
> passed  => [[8 SEC without recommendation]]
> history => [[8 referred SEC/SJC] [8 sent SEC] [8 passed SEC w/o rec] [8 withdrawn] [8 referred SEC/SFC] [8 sent SFC]]

# 2023-03-10 /cncrd at end of string
= HPREF [2] HCPAC/HJC-HCPAC- DP-HJC [3] DP [4] fl/a- PASSED/H (37-32) [8] SJC/SFC-SJC [10] DP/a-SFC- DP [12] fl/a- PASSED/S (24-16) [15] h/cncrd
> passed  => [[2 HCPAC with Do Pass recommendation] [3 HJC with Do Pass recommendation] [4 House 37-32] [10 SJC with Do Pass, as amended] [10 SFC with Do Pass recommendation] [12 Senate 24-16] [15 House concur h/cncrd]]
> history => [[0 prefile H] [2 referred HCPAC/HJC] [2 sent HCPAC] [2 passed HCPAC DP] [2 sent HJC] [3 passed HJC DP] [4 floor amendment fl/a] [4 passed House 37-32] [8 referred SJC/SFC] [8 sent SJC] [10 passed SJC DP/a] [10 sent SFC] [10 passed SFC DP] [12 floor amendment fl/a] [12 passed Senate 24-16] [15 House concur h/cncrd]]

= [1] HAFC-HAFC- DP [2] PASSED/H (47-19) [1] SFC-SFC- DP [2] PASSED/S (33-5)- SGND BY GOV (Jan. 20) Ch. 1.
> cur     => signed
> passed  => [[1 HAFC with Do Pass recommendation] [2 House 47-19] [1 SFC with Do Pass recommendation] [2 Senate 33-5] [2 signed SGND BY GOV (Jan. 20) Ch. 1.]]
> history => [[1 referred HAFC] [1 sent HAFC] [1 passed HAFC DP] [2 passed House 47-19] [1 referred SFC] [1 sent SFC] [1 passed SFC DP] [2 passed Senate 33-5] [2 signed SGND BY GOV (Jan. 20) Ch. 1.]]
> signed  => {ch=1, date=[1 20 January 20]}

# 2024-01-18 new to me
= [2] rcld frm/h
> cur     => Recalled from House
> history => [[2 recalled from House rcld frm/h]]

# 2024-02-06 another new one (SB6)
= [1] SCC/SJC/SFC-SCC [2]germane-SJC [4] DNP-CS/DP [6] DP - fl/aa- PASSED/S (25-15) [9] HJC-HJC
> cur     => HJC
> history => [[1 referred SCC/SJC/SFC] [1 sent SCC] [2 germane SCC] [2 sent SJC] [4 passed SJC DNP-CS/DP] [6 passed SFC DP] [6 floor amendment fl/aa] [6 passed Senate 25-15] [9 referred HJC] [9 sent HJC]]
> passed  => [[2 SCC Germane] [4 SJC with Committee Substitution] [6 SFC with Do Pass recommendation] [6 Senate 25-15]]
> refer   => [HJC]

# 2024-02-08 SB230
= [4] SCC/SHPAC/SJC-SCC [7] SCC referral removed- ref SHPAC/SJC-SHPAC
> cur     => SHPAC
> history => [[4 referred SCC/SHPAC/SJC] [4 sent SCC] [7 referral removed SCC] [7 referred SHPAC/SJC] [7 sent SHPAC]]
> refer   => [SHPAC SJC]

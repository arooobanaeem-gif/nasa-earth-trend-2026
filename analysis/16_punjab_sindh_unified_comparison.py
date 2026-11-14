
"""NASA Space Apps — Punjab/Sindh nine-variable JJAS comparison, 2001–2025.

Run from project root:
    python analysis/16_punjab_sindh_unified_comparison.py

Dependencies: numpy, pandas, scipy, pymannkendall, matplotlib.
"""

from pathlib import Path

import numpy as np
import pandas as pd
import pymannkendall as mk
from scipy.stats import theilslopes, pearsonr, spearmanr

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


# ==========================================================
# 1. PROJECT PATHS AND CONFIGURATION
# ==========================================================

ROOT = Path(__file__).resolve().parents[1]

SOURCE = (
    ROOT / "data" /
    "punjab_sindh_all_variables_2001_2025.csv"
)

RESULTS = ROOT / "results"
FIGURES = RESULTS / "figures"

RESULTS.mkdir(parents=True, exist_ok=True)
FIGURES.mkdir(parents=True, exist_ok=True)

VARIABLES = {
    "rx1day_mm": ("Rx1day", "mm"),
    "precipitation_mm": ("JJAS precipitation", "mm"),
    "surface_runoff_mm": ("Surface runoff", "mm"),
    "subsurface_runoff_mm": ("Subsurface runoff", "mm"),
    "total_runoff_mm": ("Total runoff", "mm"),
    "soil_0_10": ("Soil moisture 0–10 cm", "m³/m³"),
    "soil_10_40": ("Soil moisture 10–40 cm", "m³/m³"),
    "soil_40_100": ("Soil moisture 40–100 cm", "m³/m³"),
    "soil_100_200": ("Soil moisture 100–200 cm", "m³/m³"),
}

REGIONS = ("Punjab", "Sindh")
YEARS = np.arange(2001, 2026)
FLOOD_YEARS = (2010, 2022, 2025)


# ==========================================================
# 2. DATA VALIDATION
# ==========================================================

def validate(df):

    required = [
        "year",
        "region",
        *VARIABLES,
        "jjas_days",
        "incomplete_days",
        "imerg_images",
        "fldas_months",
    ]

    missing_cols = set(required).difference(df.columns)

    assert not missing_cols, (
        f"Missing columns: {sorted(missing_cols)}"
    )

    assert len(df) == 50, (
        f"Expected 50 records, found {len(df)}"
    )

    assert not df[required].isna().any().any(), (
        "Missing values in required columns"
    )

    assert not df.duplicated(
        ["year", "region"]
    ).any(), "Duplicate year-region records"

    assert set(df["region"]) == set(REGIONS), (
        "Unexpected region names"
    )

    for region in REGIONS:

        part = (
            df.loc[df.region == region]
            .sort_values("year")
        )

        assert np.array_equal(
            part.year.to_numpy(),
            YEARS
        ), f"Year mismatch: {region}"

    assert (df.jjas_days == 122).all(), (
        "JJAS days mismatch"
    )

    assert (df.incomplete_days == 0).all(), (
        "Incomplete IMERG days detected"
    )

    assert (df.imerg_images == 5856).all(), (
        "IMERG count mismatch"
    )

    assert (df.fldas_months == 4).all(), (
        "FLDAS month count mismatch"
    )

    assert np.isfinite(
        df[list(VARIABLES)].to_numpy(dtype=float)
    ).all(), "Nonfinite measurements"

    balance = (
        df.surface_runoff_mm
        + df.subsurface_runoff_mm
        - df.total_runoff_mm
    ).abs().max()

    assert balance < 1e-7, (
        f"Runoff balance mismatch: {balance}"
    )

    for var in VARIABLES:
        assert (df[var] >= 0).all(), (
            f"Negative values in {var}"
        )

    for var in (
        "soil_0_10",
        "soil_10_40",
        "soil_40_100",
        "soil_100_200",
    ):
        assert (df[var] <= 1).all(), (
            f"Soil moisture > 1 in {var}"
        )

    print(
        "VALIDATED: 50 rows, 25 years, "
        "2 regions, 9 variables; "
        f"max runoff balance error {balance:.3g}"
    )


# ==========================================================
# 3. TREND STATISTICS
# ==========================================================

def trend(values, years):

    values = np.asarray(values, dtype=float)
    years = np.asarray(years, dtype=float)

    # Original Mann-Kendall
    original = mk.original_test(values)

    # Yue-Wang lag-1 variance-adjusted MK
    adjusted = mk.yue_wang_modification_test(
        values,
        lag=1
    )

    # Theil-Sen slope and 95% CI
    sen = theilslopes(
        values,
        years,
        0.95
    )

    # Lag-1 autocorrelation
    lag1 = (
        float(
            np.corrcoef(
                values[:-1],
                values[1:]
            )[0, 1]
        )
        if np.std(values) > 0
        else np.nan
    )

    return {
        "n_years": len(values),
        "mean": float(np.mean(values)),
        "median": float(np.median(values)),
        "std": float(np.std(values, ddof=1)),
        "sen_slope_per_year": float(sen.slope),
        "slope_ci_lower": float(sen.low_slope),
        "slope_ci_upper": float(sen.high_slope),
        "kendall_tau": float(original.Tau),
        "original_mk_p": float(original.p),
        "yue_wang_lag1_p": float(adjusted.p),
        "lag1_autocorrelation": lag1,
        "original_significant_05": bool(
            original.p < 0.05
        ),
        "adjusted_significant_05": bool(
            adjusted.p < 0.05
        ),
    }


# ==========================================================
# 4. SAVE CSV HELPER
# ==========================================================

def save(df, filename):

    path = RESULTS / filename

    df.to_csv(path, index=False)

    print(
        "Saved:",
        path.relative_to(ROOT)
    )


# ==========================================================
# 5. MAIN ANALYSIS
# ==========================================================

def main():

    df = pd.read_csv(SOURCE)

    validate(df)

    df["year"] = df["year"].astype(int)

    df = (
        df.sort_values(["region", "year"])
        .reset_index(drop=True)
    )

    # ------------------------------------------------------
    # A. REGIONAL TREND STATISTICS
    # ------------------------------------------------------

    trend_rows = []

    for region in REGIONS:

        sub = df[df.region == region]

        for var, (label, unit) in VARIABLES.items():

            trend_rows.append({
                "region": region,
                "variable": var,
                "label": label,
                "unit": unit,
                **trend(
                    sub[var],
                    sub.year
                )
            })

    trends = pd.DataFrame(trend_rows)

    save(
        trends,
        "punjab_sindh_unified_trends.csv"
    )

    # ------------------------------------------------------
    # B. PAIRED-YEAR REGIONAL DIFFERENCES
    # ------------------------------------------------------

    # Difference = Sindh minus Punjab.
    # A trend in this difference tests whether the
    # regional gap changes over time.

    p = (
        df[df.region == "Punjab"]
        .set_index("year")
        .loc[YEARS]
    )

    s = (
        df[df.region == "Sindh"]
        .set_index("year")
        .loc[YEARS]
    )

    differences = pd.DataFrame({
        "year": YEARS
    })

    diff_trend_rows = []

    for var, (label, unit) in VARIABLES.items():

        d = (
            s[var].to_numpy()
            - p[var].to_numpy()
        )

        differences[var] = d

        diff_trend_rows.append({
            "variable": var,
            "label": label,
            "unit": unit,
            "difference_definition": (
                "Sindh minus Punjab"
            ),
            **trend(d, YEARS)
        })

    save(
        differences,
        "punjab_sindh_annual_differences.csv"
    )

    difference_trends = pd.DataFrame(
        diff_trend_rows
    )

    save(
        difference_trends,
        "punjab_sindh_difference_trends.csv"
    )

    # ------------------------------------------------------
    # C. ANNUAL ANOMALIES
    # ------------------------------------------------------

    # Baseline: each region's 2001–2025 mean.

    anomalies = df[
        ["year", "region"]
    ].copy()

    for var in VARIABLES:

        means = (
            df.groupby("region")[var]
            .transform("mean")
        )

        anomalies[
            var + "_anomaly"
        ] = df[var] - means

        anomalies[
            var + "_pct_anomaly"
        ] = np.where(
            means != 0,
            100 * (df[var] - means) / means,
            np.nan
        )

    save(
        anomalies,
        "punjab_sindh_annual_anomalies.csv"
    )

    selected_anomalies = anomalies[
        anomalies.year.isin(FLOOD_YEARS)
    ]

    save(
        selected_anomalies,
        "punjab_sindh_selected_year_anomalies.csv"
    )

    # ------------------------------------------------------
    # D. VARIABLE CORRELATIONS
    # ------------------------------------------------------

    # Descriptive associations only.
    # Correlation does not establish causation.

    pairs = [
        (
            "precipitation_mm",
            "surface_runoff_mm"
        ),
        (
            "precipitation_mm",
            "subsurface_runoff_mm"
        ),
        (
            "precipitation_mm",
            "total_runoff_mm"
        ),
        (
            "rx1day_mm",
            "total_runoff_mm"
        ),
        *[
            (v, "total_runoff_mm")
            for v in VARIABLES
            if v.startswith("soil_")
        ],
    ]

    corr_rows = []

    for region in REGIONS:

        sub = (
            df[df.region == region]
            .sort_values("year")
        )

        for x, y in pairs:

            pr, pp = pearsonr(
                sub[x],
                sub[y]
            )

            sr, sp = spearmanr(
                sub[x],
                sub[y]
            )

            corr_rows.append({
                "region": region,
                "x": x,
                "y": y,
                "n_years": 25,
                "pearson_r": pr,
                "pearson_p": pp,
                "spearman_rho": sr,
                "spearman_p": sp,
            })

    save(
        pd.DataFrame(corr_rows),
        "punjab_sindh_variable_correlations.csv"
    )

    # ------------------------------------------------------
    # E. TIME-SERIES FIGURES — ALL NINE VARIABLES
    # ------------------------------------------------------

    for var, (label, unit) in VARIABLES.items():

        fig, ax = plt.subplots(
            figsize=(9, 4.5)
        )

        for region in REGIONS:

            sub = (
                df[df.region == region]
                .sort_values("year")
            )

            line, = ax.plot(
                sub.year,
                sub[var],
                marker="o",
                markersize=3,
                linewidth=1.6,
                label=region
            )

            slope = trends[
                (trends.region == region)
                & (trends.variable == var)
            ].iloc[0]

            fitted = (
                slope.sen_slope_per_year
                * (YEARS - YEARS.mean())
                + sub[var].median()
            )

            ax.plot(
                YEARS,
                fitted,
                linestyle="--",
                linewidth=1,
                alpha=0.6,
                color=line.get_color()
            )

        ax.set(
            title=(
                f"Punjab vs Sindh — {label} "
                "(JJAS, 2001–2025)"
            ),
            xlabel="Year",
            ylabel=f"{label} ({unit})"
        )

        ax.set_xticks(YEARS[::3])
        ax.grid(alpha=0.25)
        ax.legend()

        fig.tight_layout()

        fig.savefig(
            FIGURES /
            f"punjab_sindh_{var}_timeseries.png",
            dpi=180
        )

        plt.close(fig)

    # ------------------------------------------------------
    # F. ADJUSTED TREND P-VALUE HEATMAP
    # ------------------------------------------------------

    pivot = trends.pivot(
        index="variable",
        columns="region",
        values="yue_wang_lag1_p"
    ).loc[
        list(VARIABLES),
        list(REGIONS)
    ]

    fig, ax = plt.subplots(
        figsize=(7.5, 6)
    )

    im = ax.imshow(
        pivot.to_numpy(),
        vmin=0,
        vmax=1,
        aspect="auto",
        cmap="viridis_r"
    )

    ax.set_xticks(
        range(len(REGIONS)),
        REGIONS
    )

    ax.set_yticks(
        range(len(VARIABLES)),
        [VARIABLES[v][0] for v in VARIABLES]
    )

    for i in range(len(VARIABLES)):
        for j in range(len(REGIONS)):

            val = pivot.iloc[i, j]

            ax.text(
                j,
                i,
                f"{val:.3f}",
                ha="center",
                va="center",
                color=(
                    "white"
                    if val > 0.55
                    else "black"
                ),
                fontsize=9
            )

    ax.set_title(
        "Yue–Wang lag-1 adjusted "
        "Mann–Kendall p-values"
    )

    fig.colorbar(
        im,
        ax=ax,
        label="Adjusted p-value"
    )

    fig.tight_layout()

    fig.savefig(
        FIGURES /
        "punjab_sindh_adjusted_trend_pvalues.png",
        dpi=180
    )

    plt.close(fig)

    # ------------------------------------------------------
    # G. SELECTED-YEAR ANOMALY FIGURES
    # ------------------------------------------------------

    focus = [
        "rx1day_mm",
        "precipitation_mm",
        "total_runoff_mm"
    ]

    selected = anomalies[
        anomalies.year.isin(FLOOD_YEARS)
    ]

    for var in focus:

        fig, ax = plt.subplots(
            figsize=(8, 4)
        )

        x = np.arange(
            len(FLOOD_YEARS)
        )

        for j, region in enumerate(REGIONS):

            vals = (
                selected[
                    selected.region == region
                ]
                .set_index("year")
                .loc[
                    list(FLOOD_YEARS),
                    var + "_pct_anomaly"
                ]
            )

            ax.bar(
                x + (j - 0.5) * 0.36,
                vals,
                width=0.36,
                label=region
            )

        ax.axhline(
            0,
            color="black",
            linewidth=0.8
        )

        ax.set_xticks(
            x,
            [
                str(y)
                for y in FLOOD_YEARS
            ]
        )

        ax.set(
            ylabel=(
                "Anomaly relative to regional "
                "2001–2025 mean (%)"
            ),
            title=(
                "Selected-year anomalies — "
                f"{VARIABLES[var][0]}"
            )
        )

        ax.legend()
        fig.tight_layout()

        fig.savefig(
            FIGURES /
            f"punjab_sindh_{var}_selected_year_anomalies.png",
            dpi=180
        )

        plt.close(fig)

    # ------------------------------------------------------
    # H. PRINT SUMMARY
    # ------------------------------------------------------

    print(
        "\nRegional trends "
        "(adjusted p-values):"
    )

    print(
        trends[
            [
                "region",
                "variable",
                "sen_slope_per_year",
                "original_mk_p",
                "yue_wang_lag1_p"
            ]
        ].to_string(index=False)
    )

    print(
        "\nDirect regional-difference "
        "trend tests:"
    )

    print(
        difference_trends[
            [
                "variable",
                "sen_slope_per_year",
                "yue_wang_lag1_p"
            ]
        ].to_string(index=False)
    )

    print(
        "\nSaved 6 statistical CSVs "
        "and 13 figures under results/."
    )

    print(
        "NOTE: p-values are unadjusted "
        "for multiple testing; correlations "
        "are descriptive and not causal."
    )


if __name__ == "__main__":
    main()

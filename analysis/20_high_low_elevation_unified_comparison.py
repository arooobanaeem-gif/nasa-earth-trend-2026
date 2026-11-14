
"""
NASA Space Apps Challenge 2026
Earth System Trend Detective

COMPARISON 3:
High-Elevation vs Low-Elevation Indus Basin (2001–2025)

Statistical methods:
- Mann–Kendall trend test
- Yue–Wang lag-1 autocorrelation-adjusted Mann–Kendall
- Sen's slope with 95% confidence interval
- Benjamini–Hochberg FDR correction
- Direct High-minus-Low difference trends
- Annual and selected-year anomalies
- Pearson and Spearman correlations

Outputs:
- 6 statistical CSV files
- 17 PNG figures

Run:
python analysis/20_high_low_elevation_unified_comparison.py
"""

from pathlib import Path

import numpy as np
import pandas as pd
import pymannkendall as mk

from scipy.stats import (
    theilslopes,
    pearsonr,
    spearmanr
)

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt


# ==================================================
# 1. PATHS AND CONFIGURATION
# ==================================================

ROOT = Path(__file__).resolve().parents[1]

DATA = (
    ROOT
    / "data"
    / "indus_high_low_all_variables_2001_2025.csv"
)

OUT = ROOT / "results"
FIG = OUT / "figures"

OUT.mkdir(exist_ok=True)
FIG.mkdir(exist_ok=True)

PREFIX = "high_low_elevation"

YEARS = np.arange(2001, 2026)

REGIONS = (
    "Low Elevation",
    "High Elevation"
)

VARIABLES = {
    "rx1day_mm": (
        "Rx1day",
        "mm"
    ),

    "precipitation_mm": (
        "JJAS precipitation",
        "mm"
    ),

    "surface_runoff_mm": (
        "Surface runoff (FLDAS)",
        "mm"
    ),

    "subsurface_runoff_mm": (
        "Subsurface runoff (FLDAS)",
        "mm"
    ),

    "total_runoff_mm": (
        "Total runoff (FLDAS)",
        "mm"
    ),

    "soil_0_10": (
        "Soil moisture 0–10 cm",
        "m³/m³"
    ),

    "soil_10_40": (
        "Soil moisture 10–40 cm",
        "m³/m³"
    ),

    "soil_40_100": (
        "Soil moisture 40–100 cm",
        "m³/m³"
    ),

    "soil_100_200": (
        "Soil moisture 100–200 cm",
        "m³/m³"
    ),

    "lst_c": (
        "Daytime land surface temperature",
        "°C"
    ),

    "snow_index": (
        "NDSI snow-cover index",
        "index"
    ),

    "swe_mm": (
        "Snow water equivalent (FLDAS)",
        "mm"
    )
}


# ==================================================
# 2. SAVE CSV HELPER
# ==================================================

def save(frame, suffix):

    path = OUT / f"{PREFIX}_{suffix}.csv"

    frame.to_csv(
        path,
        index=False
    )

    print(
        "Saved",
        path.relative_to(ROOT)
    )


# ==================================================
# 3. DATA VALIDATION
# ==================================================

def validate(df):

    required = [
        "year",
        "region",
        *VARIABLES,

        "jjas_days",
        "incomplete_days",
        "imerg_images",
        "fldas_months",
        "lst_composites",
        "snow_daily_images",
        "swe_months"
    ]

    missing = set(required) - set(df.columns)

    assert not missing, (
        f"Missing columns: {missing}"
    )

    assert len(df) == 50, (
        f"Expected 50 rows, got {len(df)}"
    )

    assert not df[required].isna().any().any(), (
        "Dataset contains missing values"
    )

    assert not df.duplicated(
        ["year", "region"]
    ).any(), (
        "Duplicate year-region records"
    )

    assert set(df["region"]) == set(REGIONS), (
        "Unexpected region names"
    )

    for region in REGIONS:

        region_years = np.sort(
            df.loc[
                df["region"] == region,
                "year"
            ].astype(int)
        )

        assert np.array_equal(
            region_years,
            YEARS
        ), (
            f"Missing or unexpected years: {region}"
        )

    assert (df["jjas_days"] == 122).all()

    assert (df["incomplete_days"] == 0).all()

    assert (df["imerg_images"] == 5856).all()

    assert (df["fldas_months"] == 4).all()

    assert (df["swe_months"] == 5).all()

    numeric = df[
        list(VARIABLES)
    ].to_numpy(float)

    assert np.isfinite(numeric).all(), (
        "Non-finite variable values"
    )

    nonnegative = [
        v for v in VARIABLES
        if v != "lst_c"
    ]

    assert (
        df[nonnegative].to_numpy(float) >= 0
    ).all(), (
        "Unexpected negative measurement"
    )

    soil_columns = [
        "soil_0_10",
        "soil_10_40",
        "soil_40_100",
        "soil_100_200"
    ]

    assert (
        (df[soil_columns] >= 0)
        & (df[soil_columns] <= 1)
    ).all().all(), (
        "Soil moisture outside 0–1"
    )

    runoff_error = (
        df["surface_runoff_mm"]
        + df["subsurface_runoff_mm"]
        - df["total_runoff_mm"]
    ).abs().max()

    assert runoff_error < 1e-6, (
        f"Runoff consistency error: {runoff_error}"
    )

    print(
        "VALIDATED: 50 rows, 25 years, "
        "2 elevation zones, 12 variables"
    )


# ==================================================
# 4. TREND STATISTICS
# ==================================================

def trend(series):

    values = np.asarray(
        series,
        dtype=float
    )

    # Original Mann–Kendall test
    original = mk.original_test(values)

    # Yue–Wang modification with lag 1
    adjusted = mk.yue_wang_modification_test(
        values,
        lag=1
    )

    # Sen's slope with confidence interval
    sen = theilslopes(
        values,
        YEARS,
        0.95
    )

    # Lag-1 autocorrelation
    if np.std(values) > 0:

        lag1 = np.corrcoef(
            values[:-1],
            values[1:]
        )[0, 1]

    else:
        lag1 = np.nan

    return {

        "n_years": 25,

        "mean": float(
            values.mean()
        ),

        "median": float(
            np.median(values)
        ),

        "sen_slope_per_year": float(
            sen.slope
        ),

        "slope_ci_lower": float(
            sen.low_slope
        ),

        "slope_ci_upper": float(
            sen.high_slope
        ),

        "kendall_tau": float(
            original.Tau
        ),

        "original_mk_p": float(
            original.p
        ),

        "yue_wang_lag1_p": float(
            adjusted.p
        ),

        "lag1_autocorrelation": float(
            lag1
        ),

        "adjusted_significant_05": bool(
            adjusted.p < 0.05
        )
    }


# ==================================================
# 5. BENJAMINI–HOCHBERG FDR
# ==================================================

def bh_fdr(pvalues):

    p = np.asarray(
        pvalues,
        dtype=float
    )

    order = np.argsort(p)

    ranked = (
        p[order]
        * len(p)
        / np.arange(
            1,
            len(p) + 1
        )
    )

    corrected = np.minimum.accumulate(
        ranked[::-1]
    )[::-1]

    q = np.empty_like(p)

    q[order] = np.minimum(
        corrected,
        1.0
    )

    return q


# ==================================================
# 6. MAIN ANALYSIS
# ==================================================

def main():

    # ----------------------------------------------
    # LOAD DATA
    # ----------------------------------------------

    df = pd.read_csv(DATA)

    validate(df)

    df["year"] = df["year"].astype(int)

    low = (
        df[df["region"] == REGIONS[0]]
        .set_index("year")
        .loc[YEARS]
    )

    high = (
        df[df["region"] == REGIONS[1]]
        .set_index("year")
        .loc[YEARS]
    )


    # ==============================================
    # A. REGIONAL AND DIFFERENCE TRENDS
    # ==============================================

    regional_rows = []

    differences = pd.DataFrame({
        "year": YEARS
    })

    difference_rows = []

    for var, (label, unit) in VARIABLES.items():

        for region, part in (
            (REGIONS[0], low),
            (REGIONS[1], high)
        ):

            regional_rows.append({

                "region": region,

                "variable": var,

                "label": label,

                "unit": unit,

                **trend(part[var])

            })

        # Direct difference:
        # High Elevation minus Low Elevation

        delta = (
            high[var].to_numpy()
            - low[var].to_numpy()
        )

        differences[var] = delta

        difference_rows.append({

            "variable": var,

            "label": label,

            "unit": unit,

            "difference_definition":
                "High Elevation minus Low Elevation",

            **trend(delta)

        })

    trends = pd.DataFrame(
        regional_rows
    )

    difference_trends = pd.DataFrame(
        difference_rows
    )

    # FDR correction across 12 direct
    # difference-trend tests only.

    difference_trends["fdr_bh_q"] = bh_fdr(
        difference_trends["yue_wang_lag1_p"]
    )

    difference_trends["fdr_significant_05"] = (
        difference_trends["fdr_bh_q"] < 0.05
    )

    save(
        trends,
        "regional_trends"
    )

    save(
        differences,
        "annual_differences"
    )

    save(
        difference_trends,
        "difference_trends_fdr"
    )


    # ==============================================
    # B. ANNUAL ANOMALIES
    # ==============================================

    anomalies = df[
        ["year", "region"]
    ].copy()

    for var in VARIABLES:

        region_mean = df.groupby(
            "region"
        )[var].transform("mean")

        anomalies[
            var + "_anomaly"
        ] = (
            df[var] - region_mean
        )

        anomalies[
            var + "_pct_anomaly"
        ] = np.where(

            region_mean != 0,

            100 * (
                df[var] - region_mean
            ) / region_mean,

            np.nan
        )

    save(
        anomalies,
        "annual_anomalies"
    )

    selected_years = [
        2010,
        2022,
        2025
    ]

    selected = anomalies[
        anomalies["year"].isin(
            selected_years
        )
    ]

    save(
        selected,
        "selected_year_anomalies"
    )


    # ==============================================
    # C. CORRELATIONS
    # ==============================================

    correlations = []

    pairs = [

        (
            "precipitation_mm",
            "total_runoff_mm"
        ),

        (
            "rx1day_mm",
            "total_runoff_mm"
        ),

        (
            "precipitation_mm",
            "surface_runoff_mm"
        ),

        *[
            (
                v,
                "total_runoff_mm"
            )
            for v in VARIABLES
            if v.startswith("soil_")
        ],

        (
            "snow_index",
            "swe_mm"
        )

    ]

    for region, part in (
        (REGIONS[0], low),
        (REGIONS[1], high)
    ):

        for x, y in pairs:

            a = part[x].to_numpy()
            b = part[y].to_numpy()

            if (
                np.std(a) == 0
                or np.std(b) == 0
            ):

                pr = np.nan
                pp = np.nan
                sr = np.nan
                sp = np.nan

            else:

                pr, pp = pearsonr(
                    a,
                    b
                )

                sr, sp = spearmanr(
                    a,
                    b
                )

            correlations.append({

                "region": region,

                "x": x,

                "y": y,

                "n_years": 25,

                "pearson_r": pr,

                "pearson_p": pp,

                "spearman_rho": sr,

                "spearman_p": sp

            })

    save(
        pd.DataFrame(correlations),
        "correlations"
    )


    # ==============================================
    # D. TIME-SERIES FIGURES
    # ==============================================

    for var, (label, unit) in VARIABLES.items():

        fig, ax = plt.subplots(
            figsize=(9, 4.6)
        )

        for region, part in (
            (REGIONS[0], low),
            (REGIONS[1], high)
        ):

            line, = ax.plot(

                YEARS,

                part[var],

                marker="o",

                markersize=3,

                linewidth=1.6,

                label=region

            )

            regional_row = trends[
                (trends["region"] == region)
                & (trends["variable"] == var)
            ].iloc[0]

            slope = regional_row[
                "sen_slope_per_year"
            ]

            fitted = (
                np.median(part[var])
                + slope
                * (
                    YEARS - np.median(YEARS)
                )
            )

            ax.plot(

                YEARS,

                fitted,

                "--",

                linewidth=1,

                color=line.get_color(),

                alpha=0.75

            )

        season = (
            "May–Sep"
            if var in (
                "snow_index",
                "swe_mm"
            )
            else "JJAS"
        )

        ax.set(

            title=(
                f"Indus elevation zones: "
                f"{label} "
                f"({season}, 2001–2025)"
            ),

            xlabel="Year",

            ylabel=f"{label} ({unit})"

        )

        ax.set_xticks(
            YEARS[::3]
        )

        ax.grid(
            alpha=0.25
        )

        ax.legend()

        fig.tight_layout()

        fig.savefig(

            FIG / (
                f"{PREFIX}_{var}_timeseries.png"
            ),

            dpi=180

        )

        plt.close(fig)


    # ==============================================
    # E. REGIONAL TREND SIGNIFICANCE FIGURE
    # ==============================================

    fig, ax = plt.subplots(
        figsize=(8, 6.5)
    )

    matrix = trends.pivot(

        index="variable",

        columns="region",

        values="yue_wang_lag1_p"

    ).loc[
        list(VARIABLES),
        list(REGIONS)
    ]

    im = ax.imshow(

        matrix.to_numpy(),

        vmin=0,

        vmax=1,

        aspect="auto",

        cmap="viridis_r"

    )

    ax.set_xticks(
        [0, 1],
        REGIONS
    )

    ax.set_yticks(

        np.arange(
            len(VARIABLES)
        ),

        [
            v[0]
            for v in VARIABLES.values()
        ]

    )

    for i in range(
        len(VARIABLES)
    ):

        for j in range(2):

            ax.text(

                j,

                i,

                f"{matrix.iloc[i, j]:.3f}",

                ha="center",

                va="center",

                fontsize=8,

                color=(
                    "white"
                    if matrix.iloc[i, j] > 0.55
                    else "black"
                )

            )

    ax.set_title(
        "Regional trend p-values "
        "(Yue–Wang lag 1)"
    )

    fig.colorbar(
        im,
        ax=ax,
        label="p-value"
    )

    fig.tight_layout()

    fig.savefig(

        FIG / (
            f"{PREFIX}_regional_trend_pvalues.png"
        ),

        dpi=180

    )

    plt.close(fig)


    # ==============================================
    # F. DIRECT DIFFERENCE FDR FIGURE
    # ==============================================

    fig, ax = plt.subplots(
        figsize=(8, 6.5)
    )

    q = difference_trends[
        "fdr_bh_q"
    ].to_numpy()

    ax.barh(

        np.arange(
            len(q)
        ),

        -np.log10(
            np.maximum(
                q,
                1e-15
            )
        )

    )

    ax.axvline(

        -np.log10(0.05),

        linestyle="--",

        color="black",

        linewidth=1,

        label="FDR q = 0.05"

    )

    ax.set_yticks(

        np.arange(
            len(q)
        ),

        [
            v[0]
            for v in VARIABLES.values()
        ]

    )

    ax.invert_yaxis()

    ax.set(

        xlabel=(
            "-log10(FDR-adjusted q-value)"
        ),

        title=(
            "High minus Low: "
            "trend differences"
        )

    )

    ax.legend()

    fig.tight_layout()

    fig.savefig(

        FIG / (
            f"{PREFIX}_difference_trends_fdr.png"
        ),

        dpi=180

    )

    plt.close(fig)


    # ==============================================
    # G. SELECTED-YEAR ANOMALY FIGURES
    # ==============================================

    selected = anomalies[
        anomalies["year"].isin(
            selected_years
        )
    ]

    for var in (

        "precipitation_mm",

        "rx1day_mm",

        "total_runoff_mm"

    ):

        fig, ax = plt.subplots(
            figsize=(8, 4.5)
        )

        x = np.arange(3)

        for j, region in enumerate(
            REGIONS
        ):

            vals = (
                selected[
                    selected["region"] == region
                ]
                .set_index("year")
                .loc[
                    selected_years,
                    var + "_pct_anomaly"
                ]
            )

            ax.bar(

                x + (j - 0.5) * 0.35,

                vals,

                width=0.35,

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
                str(year)
                for year in selected_years
            ]

        )

        ax.set(

            ylabel=(
                "Anomaly vs own "
                "2001–2025 mean (%)"
            ),

            title=(
                "Selected-year anomalies: "
                + VARIABLES[var][0]
            )

        )

        ax.legend()

        fig.tight_layout()

        fig.savefig(

            FIG / (
                f"{PREFIX}_{var}"
                "_selected_year_anomalies.png"
            ),

            dpi=180

        )

        plt.close(fig)


    # ==============================================
    # H. TERMINAL SUMMARY
    # ==============================================

    print(
        "\nDIRECT HIGH MINUS LOW "
        "DIFFERENCE TRENDS:"
    )

    print(

        difference_trends[[

            "variable",

            "sen_slope_per_year",

            "yue_wang_lag1_p",

            "fdr_bh_q",

            "fdr_significant_05"

        ]].to_string(
            index=False
        )

    )

    print(
        "\n2022 percent anomalies "
        "vs each zone's 25-year mean:"
    )

    print(

        anomalies[
            anomalies["year"] == 2022
        ][[

            "region",

            "precipitation_mm_pct_anomaly",

            "rx1day_mm_pct_anomaly",

            "total_runoff_mm_pct_anomaly"

        ]].to_string(
            index=False
        )

    )

    print(
        "\nFinished: 6 CSVs and 17 PNGs."
    )

    print(
        "FDR correction applies to "
        "the 12 direct-difference tests only."
    )


# ==================================================
# 7. EXECUTE
# ==================================================

if __name__ == "__main__":

    main()

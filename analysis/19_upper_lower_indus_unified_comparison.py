
"""
NASA Space Apps Challenge 2026
Upper vs Lower Indus — Unified Statistical Comparison
Study period: 2001–2025

Operational boundary:
Chashma-area upstream catchment vs remaining Indus Basin.

ANALYSIS:
1. Data validation
2. Regional Mann–Kendall and Theil–Sen trends
3. Lag-1 Yue–Wang adjusted significance
4. Direct Lower-minus-Upper difference trends
5. Benjamini–Hochberg FDR correction
6. Annual and selected-year anomalies
7. Pearson and Spearman correlations
8. Seventeen comparison figures

INPUT:
data/upper_lower_indus_all_variables_2001_2025.csv

OUTPUT:
7 statistical CSVs in results/
17 PNG figures in results/figures/

Run:
python analysis/19_upper_lower_indus_unified_comparison.py
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

from statsmodels.stats.multitest import multipletests

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt


# ==================================================
# 1. PROJECT PATHS
# ==================================================

ROOT = Path(__file__).resolve().parents[1]

SOURCE = (
    ROOT
    / "data"
    / "upper_lower_indus_all_variables_2001_2025.csv"
)

RESULTS = ROOT / "results"

FIGURES = RESULTS / "figures"

RESULTS.mkdir(
    parents=True,
    exist_ok=True
)

FIGURES.mkdir(
    parents=True,
    exist_ok=True
)


# ==================================================
# 2. STUDY CONFIGURATION
# ==================================================

REGIONS = (
    "Upper Indus",
    "Lower Indus"
)

YEARS = np.arange(
    2001,
    2026
)

SELECTED_YEARS = (
    2010,
    2022,
    2025
)

VARIABLES = {

    "rx1day_mm": (
        "Rx1day precipitation",
        "mm",
        "JJAS"
    ),

    "precipitation_mm": (
        "Seasonal precipitation",
        "mm",
        "JJAS"
    ),

    "surface_runoff_mm": (
        "Surface runoff",
        "mm",
        "JJAS"
    ),

    "subsurface_runoff_mm": (
        "Subsurface runoff",
        "mm",
        "JJAS"
    ),

    "total_runoff_mm": (
        "Total runoff",
        "mm",
        "JJAS"
    ),

    "soil_0_10": (
        "Soil moisture 0–10 cm",
        "m³/m³",
        "JJAS"
    ),

    "soil_10_40": (
        "Soil moisture 10–40 cm",
        "m³/m³",
        "JJAS"
    ),

    "soil_40_100": (
        "Soil moisture 40–100 cm",
        "m³/m³",
        "JJAS"
    ),

    "soil_100_200": (
        "Soil moisture 100–200 cm",
        "m³/m³",
        "JJAS"
    ),

    "lst_c": (
        "Daytime land surface temperature",
        "°C",
        "JJAS"
    ),

    "snow_index": (
        "NDSI snow-cover index",
        "index",
        "May–Sep"
    ),

    "swe_mm": (
        "Snow water equivalent",
        "mm",
        "May–Sep"
    )

}


# ==================================================
# 3. SAVE RESULTS
# ==================================================

def save(df, filename):

    path = RESULTS / filename

    df.to_csv(
        path,
        index=False
    )

    print(
        "Saved:",
        path.relative_to(ROOT)
    )


# ==================================================
# 4. VALIDATE INPUT DATA
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

    missing = (
        set(required)
        - set(df.columns)
    )

    assert not missing, (
        f"Missing columns: {sorted(missing)}"
    )

    assert len(df) == 50, (
        f"Expected 50 records, got {len(df)}"
    )

    assert not df[required].isna().any().any(), (
        "Missing values found"
    )

    assert not df.duplicated(
        ["year", "region"]
    ).any(), (
        "Duplicate year-region records"
    )

    assert set(df["region"]) == set(REGIONS), (
        "Unexpected regional labels"
    )

    for region in REGIONS:

        sub = df[
            df["region"] == region
        ].sort_values("year")

        assert np.array_equal(
            sub["year"].to_numpy(),
            YEARS
        ), (
            f"Missing or incorrect years: {region}"
        )

    assert (
        df["jjas_days"] == 122
    ).all()

    assert (
        df["incomplete_days"] == 0
    ).all()

    assert (
        df["imerg_images"] == 5856
    ).all()

    assert (
        df["fldas_months"] == 4
    ).all()

    assert (
        df["swe_months"] == 5
    ).all()

    assert np.isfinite(
        df[list(VARIABLES)].to_numpy(
            dtype=float
        )
    ).all(), (
        "Non-finite measurements found"
    )

    runoff_error = (
        df["surface_runoff_mm"]
        + df["subsurface_runoff_mm"]
        - df["total_runoff_mm"]
    ).abs().max()

    assert runoff_error < 1e-7, (
        "Runoff balance check failed"
    )

    for variable in VARIABLES:

        if variable != "lst_c":

            assert (
                df[variable] >= 0
            ).all(), (
                f"Negative values: {variable}"
            )

    for variable in [
        "soil_0_10",
        "soil_10_40",
        "soil_40_100",
        "soil_100_200"
    ]:

        assert (
            df[variable] <= 1
        ).all(), (
            f"Soil moisture outside range: {variable}"
        )

    assert (
        df["snow_index"] <= 100
    ).all()

    print("\nVALIDATION PASSED")

    print(
        "50 records | 25 years | "
        "2 regions | 12 variables"
    )

    print(
        "Maximum runoff balance error:",
        runoff_error
    )

    print(
        "MODIS LST composite counts:",
        sorted(
            df["lst_composites"].unique()
        )
    )

    print(
        "MODIS snow image counts:",
        sorted(
            df["snow_daily_images"].unique()
        )
    )


# ==================================================
# 5. TREND ANALYSIS
# ==================================================

def trend(values, years):

    values = np.asarray(
        values,
        dtype=float
    )

    years = np.asarray(
        years,
        dtype=float
    )

    original = mk.original_test(
        values
    )

    adjusted = (
        mk.yue_wang_modification_test(
            values,
            lag=1
        )
    )

    sen = theilslopes(
        values,
        years,
        0.95
    )

    if np.std(values) > 0:

        lag1 = float(
            np.corrcoef(
                values[:-1],
                values[1:]
            )[0, 1]
        )

    else:

        lag1 = np.nan

    return {

        "n_years":
            len(values),

        "mean":
            float(np.mean(values)),

        "median":
            float(np.median(values)),

        "std":
            float(
                np.std(
                    values,
                    ddof=1
                )
            ),

        "sen_slope_per_year":
            float(sen.slope),

        "slope_ci_lower":
            float(sen.low_slope),

        "slope_ci_upper":
            float(sen.high_slope),

        "kendall_tau":
            float(original.Tau),

        "original_mk_p":
            float(original.p),

        "yue_wang_lag1_p":
            float(adjusted.p),

        "lag1_autocorrelation":
            lag1,

        "original_significant_05":
            bool(original.p < 0.05),

        "adjusted_significant_05":
            bool(adjusted.p < 0.05)

    }


# ==================================================
# 6. MAIN ANALYSIS
# ==================================================

def main():

    df = pd.read_csv(
        SOURCE
    )

    validate(df)

    df["year"] = (
        df["year"].astype(int)
    )

    df = df.sort_values(
        ["region", "year"]
    ).reset_index(drop=True)


    # ==============================================
    # A. REGIONAL TRENDS
    # ==============================================

    trend_rows = []

    for region in REGIONS:

        sub = df[
            df["region"] == region
        ]

        for variable, (
            label,
            unit,
            season
        ) in VARIABLES.items():

            result = trend(
                sub[variable],
                sub["year"]
            )

            trend_rows.append({

                "region": region,

                "variable": variable,

                "label": label,

                "unit": unit,

                "season": season,

                **result

            })

    trends = pd.DataFrame(
        trend_rows
    )

    save(
        trends,
        "upper_lower_unified_trends.csv"
    )


    # ==============================================
    # B. ANNUAL REGIONAL DIFFERENCES
    # ==============================================

    upper = df[
        df["region"] == "Upper Indus"
    ].set_index("year").loc[YEARS]

    lower = df[
        df["region"] == "Lower Indus"
    ].set_index("year").loc[YEARS]

    differences = pd.DataFrame({
        "year": YEARS
    })

    difference_trends_rows = []

    for variable, (
        label,
        unit,
        season
    ) in VARIABLES.items():

        difference_values = (
            lower[variable].to_numpy()
            - upper[variable].to_numpy()
        )

        differences[variable] = (
            difference_values
        )

        result = trend(
            difference_values,
            YEARS
        )

        difference_trends_rows.append({

            "variable": variable,

            "label": label,

            "unit": unit,

            "season": season,

            "difference_definition":
                "Lower minus Upper",

            **result

        })

    difference_trends = pd.DataFrame(
        difference_trends_rows
    )

    save(
        differences,
        "upper_lower_annual_differences.csv"
    )

    save(
        difference_trends,
        "upper_lower_difference_trends.csv"
    )


    # ==============================================
    # C. BENJAMINI–HOCHBERG FDR CORRECTION
    # ==============================================

    # Correct the family of 12 direct regional
    # difference trend tests.
    #
    # Use the lag-1 Yue–Wang adjusted MK p-values.
    #
    # This correction does not apply to the
    # separate regional trends or correlations.

    difference_trends_fdr = (
        difference_trends.copy()
    )

    corrected_p = multipletests(
        difference_trends_fdr[
            "yue_wang_lag1_p"
        ].to_numpy(),
        alpha=0.05,
        method="fdr_bh"
    )[1]

    difference_trends_fdr[
        "fdr_bh_p"
    ] = corrected_p

    difference_trends_fdr[
        "fdr_significant_05"
    ] = (
        difference_trends_fdr[
            "fdr_bh_p"
        ] < 0.05
    )

    save(
        difference_trends_fdr,
        "upper_lower_difference_trends_fdr.csv"
    )

    fdr_count = int(
        difference_trends_fdr[
            "fdr_significant_05"
        ].sum()
    )

    print(
        "\nFDR-significant regional differences:",
        fdr_count,
        "of",
        len(difference_trends_fdr)
    )


    # ==============================================
    # D. ANNUAL ANOMALIES
    # ==============================================

    anomalies = df[
        ["year", "region"]
    ].copy()

    for variable in VARIABLES:

        regional_mean = (
            df.groupby("region")[
                variable
            ].transform("mean")
        )

        anomalies[
            variable + "_anomaly"
        ] = (
            df[variable]
            - regional_mean
        )

        anomalies[
            variable + "_pct_anomaly"
        ] = np.where(
            regional_mean != 0,
            100 * (
                df[variable]
                - regional_mean
            ) / regional_mean,
            np.nan
        )

    save(
        anomalies,
        "upper_lower_annual_anomalies.csv"
    )

    selected_anomalies = anomalies[
        anomalies["year"].isin(
            SELECTED_YEARS
        )
    ]

    save(
        selected_anomalies,
        "upper_lower_selected_year_anomalies.csv"
    )


    # ==============================================
    # E. CORRELATIONS
    # ==============================================

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

        (
            "precipitation_mm",
            "subsurface_runoff_mm"
        ),

        (
            "lst_c",
            "snow_index"
        ),

        (
            "lst_c",
            "swe_mm"
        ),

        (
            "snow_index",
            "swe_mm"
        ),

        (
            "precipitation_mm",
            "snow_index"
        ),

        (
            "precipitation_mm",
            "swe_mm"
        )

    ]

    pairs += [

        (
            variable,
            "total_runoff_mm"
        )

        for variable in VARIABLES

        if variable.startswith(
            "soil_"
        )

    ]

    correlation_rows = []

    for region in REGIONS:

        sub = df[
            df["region"] == region
        ].sort_values("year")

        for x, y in pairs:

            xv = sub[x].to_numpy()

            yv = sub[y].to_numpy()

            if (
                np.std(xv) == 0
                or np.std(yv) == 0
            ):

                pearson_r = np.nan
                pearson_p = np.nan

                spearman_rho = np.nan
                spearman_p = np.nan

            else:

                pearson_r, pearson_p = (
                    pearsonr(xv, yv)
                )

                spearman_rho, spearman_p = (
                    spearmanr(xv, yv)
                )

            correlation_rows.append({

                "region": region,

                "x": x,

                "y": y,

                "n_years": 25,

                "pearson_r":
                    pearson_r,

                "pearson_p":
                    pearson_p,

                "spearman_rho":
                    spearman_rho,

                "spearman_p":
                    spearman_p

            })

    correlations = pd.DataFrame(
        correlation_rows
    )

    save(
        correlations,
        "upper_lower_variable_correlations.csv"
    )


    # ==============================================
    # F. TWELVE TIME-SERIES FIGURES
    # ==============================================

    for variable, (
        label,
        unit,
        season
    ) in VARIABLES.items():

        fig, ax = plt.subplots(
            figsize=(9, 4.5)
        )

        for region in REGIONS:

            sub = df[
                df["region"] == region
            ].sort_values("year")

            line, = ax.plot(
                sub["year"],
                sub[variable],
                marker="o",
                markersize=3,
                linewidth=1.6,
                label=region
            )

            slope_row = trends[
                (
                    trends["region"]
                    == region
                )
                &
                (
                    trends["variable"]
                    == variable
                )
            ].iloc[0]

            fitted = (
                slope_row[
                    "sen_slope_per_year"
                ]
                * (
                    YEARS
                    - YEARS.mean()
                )
                + sub[variable].median()
            )

            ax.plot(
                YEARS,
                fitted,
                "--",
                linewidth=1,
                alpha=0.65,
                color=line.get_color()
            )

        ax.set(
            title=(
                f"Upper vs Lower Indus — "
                f"{label} "
                f"({season}, 2001–2025)"
            ),

            xlabel="Year",

            ylabel=(
                f"{label} ({unit})"
            )
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
            FIGURES
            / (
                f"upper_lower_{variable}"
                "_timeseries.png"
            ),
            dpi=180
        )

        plt.close(fig)


    # ==============================================
    # G. ADJUSTED MK P-VALUE HEATMAP
    # ==============================================

    pivot = trends.pivot(
        index="variable",
        columns="region",
        values="yue_wang_lag1_p"
    ).loc[
        list(VARIABLES),
        list(REGIONS)
    ]

    fig, ax = plt.subplots(
        figsize=(8, 7)
    )

    im = ax.imshow(
        pivot.to_numpy(),
        vmin=0,
        vmax=1,
        aspect="auto",
        cmap="viridis_r"
    )

    ax.set_xticks(
        range(2),
        list(REGIONS)
    )

    ax.set_yticks(
        range(len(VARIABLES)),
        [
            VARIABLES[v][0]
            for v in VARIABLES
        ]
    )

    for i in range(
        len(VARIABLES)
    ):

        for j in range(2):

            value = pivot.iloc[
                i, j
            ]

            ax.text(
                j,
                i,
                f"{value:.3f}",
                ha="center",
                va="center",
                color=(
                    "white"
                    if value > 0.55
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
        FIGURES
        / "upper_lower_adjusted_trend_pvalues.png",
        dpi=180
    )

    plt.close(fig)


    # ==============================================
    # H. SELECTED-YEAR ANOMALY FIGURES
    # ==============================================

    focus_variables = [

        "rx1day_mm",

        "precipitation_mm",

        "total_runoff_mm",

        "swe_mm"

    ]

    selected = anomalies[
        anomalies["year"].isin(
            SELECTED_YEARS
        )
    ]

    for variable in focus_variables:

        fig, ax = plt.subplots(
            figsize=(8, 4)
        )

        x_positions = np.arange(
            len(SELECTED_YEARS)
        )

        for j, region in enumerate(
            REGIONS
        ):

            values = selected[
                selected["region"]
                == region
            ].set_index("year").loc[
                list(SELECTED_YEARS),
                variable
                + "_pct_anomaly"
            ]

            ax.bar(
                x_positions
                + (j - 0.5) * 0.36,

                values,

                width=0.36,

                label=region
            )

        ax.axhline(
            0,
            color="black",
            linewidth=0.8
        )

        ax.set_xticks(
            x_positions,
            [
                str(year)
                for year in SELECTED_YEARS
            ]
        )

        ax.set(
            ylabel=(
                "Anomaly relative to "
                "regional 2001–2025 mean (%)"
            ),

            title=(
                "Selected-year anomalies — "
                + VARIABLES[variable][0]
            )
        )

        ax.legend()

        fig.tight_layout()

        fig.savefig(
            FIGURES
            / (
                f"upper_lower_{variable}"
                "_selected_year_anomalies.png"
            ),
            dpi=180
        )

        plt.close(fig)


    # ==============================================
    # I. PRINT REGIONAL TREND RESULTS
    # ==============================================

    print(
        "\nREGIONAL TRENDS:"
    )

    print(
        trends[[
            "region",
            "variable",
            "sen_slope_per_year",
            "original_mk_p",
            "yue_wang_lag1_p"
        ]].to_string(
            index=False
        )
    )


    # ==============================================
    # J. PRINT DIRECT DIFFERENCE RESULTS
    # ==============================================

    print(
        "\nDIRECT REGIONAL DIFFERENCE TRENDS:"
    )

    print(
        difference_trends[[
            "variable",
            "sen_slope_per_year",
            "original_mk_p",
            "yue_wang_lag1_p"
        ]].to_string(
            index=False
        )
    )


    # ==============================================
    # K. PRINT FDR-CORRECTED RESULTS
    # ==============================================

    print(
        "\nFDR-CORRECTED DIFFERENCE TRENDS:"
    )

    print(
        difference_trends_fdr[[
            "variable",
            "sen_slope_per_year",
            "yue_wang_lag1_p",
            "fdr_bh_p",
            "fdr_significant_05"
        ]].to_string(
            index=False
        )
    )


    # ==============================================
    # L. PRINT 2022 ANOMALIES
    # ==============================================

    print(
        "\n2022 ANOMALIES:"
    )

    print(
        anomalies[
            anomalies["year"] == 2022
        ][[
            "region",
            "precipitation_mm_pct_anomaly",
            "rx1day_mm_pct_anomaly",
            "total_runoff_mm_pct_anomaly",
            "swe_mm_pct_anomaly"
        ]].to_string(
            index=False
        )
    )


    # ==============================================
    # M. FINAL COMPLETION MESSAGE
    # ==============================================

    figure_count = len(
        list(
            FIGURES.glob(
                "upper_lower_*.png"
            )
        )
    )

    print(
        "\n=================================="
    )

    print(
        "UPPER–LOWER COMPARISON COMPLETE"
    )

    print(
        "=================================="
    )

    print(
        "Statistical CSV files: 7"
    )

    print(
        "Comparison figures:",
        figure_count
    )

    print(
        "FDR-significant differences:",
        fdr_count,
        "of 12"
    )

    print(
        "Output directory:",
        RESULTS
    )

    print(
        "\nSCIENTIFIC CAUTIONS:"
    )

    print(
        "- FDR correction applies only "
        "to the 12 direct difference tests."
    )

    print(
        "- Regional trends and correlations "
        "are exploratory."
    )

    print(
        "- Correlation does not imply causation."
    )

    print(
        "- FLDAS runoff and SWE are model-derived."
    )

    print(
        "- Upper/Lower is an operational "
        "Chashma-area catchment partition."
    )


if __name__ == "__main__":

    main()

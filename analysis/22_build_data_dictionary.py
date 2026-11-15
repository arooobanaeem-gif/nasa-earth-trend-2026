
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "results" / "scientific_data_dictionary.csv"

records = [
    {
        "variable": "precipitation_mm",
        "group": "Precipitation",
        "display_name": "Monsoon Precipitation",
        "unit": "mm",
        "trend_unit": "mm/year",
        "dataset": "NASA GPM IMERG V07",
        "season": "June–September (JJAS)",
        "definition": "Total precipitation received during the monsoon season.",
        "interpretation": "A positive trend indicates increasing seasonal precipitation.",
        "caution": "Satellite-estimated precipitation; not a direct rain-gauge measurement."
    },
    {
        "variable": "lst_c",
        "group": "Land Surface Temperature",
        "display_name": "Daytime Land Surface Temperature",
        "unit": "°C",
        "trend_unit": "°C/year",
        "dataset": "NASA MODIS MOD11A2",
        "season": "June–September (JJAS)",
        "definition": "Temperature of Earth's land surface during daytime.",
        "interpretation": "A positive trend indicates warming of the land surface.",
        "caution": "Land surface temperature is not the same as air temperature."
    },
    {
        "variable": "snow_index",
        "group": "Snow Cover",
        "display_name": "Snow-Cover Index",
        "unit": "Index",
        "trend_unit": "index/year",
        "dataset": "NASA MODIS MOD10A1",
        "season": "May–September",
        "definition": "Satellite-derived index representing snow conditions.",
        "interpretation": "Changes in the index indicate changes in the selected snow indicator.",
        "caution": "Not a percentage of snow-covered area."
    },
    {
        "variable": "surface_runoff_mm",
        "group": "Runoff",
        "display_name": "Surface Runoff",
        "unit": "mm",
        "trend_unit": "mm/year",
        "dataset": "NASA FLDAS",
        "season": "June–September (JJAS)",
        "definition": "Modelled water runoff moving across the land surface.",
        "interpretation": "A positive trend indicates increasing modelled surface runoff.",
        "caution": "Model-derived estimate, not measured river discharge."
    },
    {
        "variable": "subsurface_runoff_mm",
        "group": "Runoff",
        "display_name": "Subsurface Runoff",
        "unit": "mm",
        "trend_unit": "mm/year",
        "dataset": "NASA FLDAS",
        "season": "June–September (JJAS)",
        "definition": "Modelled water runoff moving beneath the land surface.",
        "interpretation": "A positive trend indicates increasing modelled subsurface runoff.",
        "caution": "Model-derived estimate, not direct groundwater measurement."
    },
    {
        "variable": "total_runoff_mm",
        "group": "Runoff",
        "display_name": "Total Runoff",
        "unit": "mm",
        "trend_unit": "mm/year",
        "dataset": "NASA FLDAS",
        "season": "June–September (JJAS)",
        "definition": "Combined modelled surface and subsurface runoff.",
        "interpretation": "A positive trend indicates increasing modelled total runoff.",
        "caution": "Not equivalent to observed river discharge."
    },
    {
        "variable": "soil_0_10",
        "group": "Soil Moisture",
        "display_name": "Soil Moisture (0–10 cm)",
        "unit": "m³/m³",
        "trend_unit": "m³/m³/year",
        "dataset": "NASA FLDAS",
        "season": "June–September (JJAS)",
        "definition": "Modelled volumetric soil water content in the top 10 cm.",
        "interpretation": "A positive trend indicates increasing soil moisture.",
        "caution": "Model-derived estimate."
    },
    {
        "variable": "soil_10_40",
        "group": "Soil Moisture",
        "display_name": "Soil Moisture (10–40 cm)",
        "unit": "m³/m³",
        "trend_unit": "m³/m³/year",
        "dataset": "NASA FLDAS",
        "season": "June–September (JJAS)",
        "definition": "Modelled volumetric soil water content at 10–40 cm depth.",
        "interpretation": "A positive trend indicates increasing soil moisture.",
        "caution": "Model-derived estimate."
    },
    {
        "variable": "soil_40_100",
        "group": "Soil Moisture",
        "display_name": "Soil Moisture (40–100 cm)",
        "unit": "m³/m³",
        "trend_unit": "m³/m³/year",
        "dataset": "NASA FLDAS",
        "season": "June–September (JJAS)",
        "definition": "Modelled volumetric soil water content at 40–100 cm depth.",
        "interpretation": "A positive trend indicates increasing soil moisture.",
        "caution": "Model-derived estimate."
    },
    {
        "variable": "soil_100_200",
        "group": "Soil Moisture",
        "display_name": "Soil Moisture (100–200 cm)",
        "unit": "m³/m³",
        "trend_unit": "m³/m³/year",
        "dataset": "NASA FLDAS",
        "season": "June–September (JJAS)",
        "definition": "Modelled volumetric soil water content at 100–200 cm depth.",
        "interpretation": "A positive trend indicates increasing soil moisture.",
        "caution": "Model-derived estimate."
    },
    {
        "variable": "swe_mm",
        "group": "Snow Water Equivalent",
        "display_name": "Snow Water Equivalent",
        "unit": "mm",
        "trend_unit": "mm/year",
        "dataset": "NASA FLDAS",
        "season": "May–September",
        "definition": "Modelled amount of water stored in snow, expressed as equivalent water depth.",
        "interpretation": "A positive trend indicates increasing modelled snow water equivalent.",
        "caution": "Model-derived estimate, not a direct measurement of glacier mass."
    },
    {
        "variable": "rx1day_mm",
        "group": "Extreme Precipitation",
        "display_name": "Maximum One-Day Precipitation (Rx1day)",
        "unit": "mm",
        "trend_unit": "mm/year",
        "dataset": "NASA GPM IMERG V07",
        "season": "June–September (JJAS)",
        "definition": "Largest single-day precipitation total during the monsoon season.",
        "interpretation": "A positive trend indicates increasing magnitude of the seasonal wettest day.",
        "caution": "An extreme precipitation indicator, not a direct measure of flooding."
    }
]

df = pd.DataFrame(records)

master = pd.read_csv(
    ROOT / "results" / "master_scientific_results.csv"
)

master_variables = set(master["variable"].dropna())
dictionary_variables = set(df["variable"])

if master_variables != dictionary_variables:
    raise ValueError(
        f"Variable mismatch!\n"
        f"Missing from dictionary: {master_variables - dictionary_variables}\n"
        f"Extra in dictionary: {dictionary_variables - master_variables}"
    )

if df["variable"].duplicated().any():
    raise ValueError("Duplicate variable names in dictionary.")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(OUTPUT, index=False, encoding="utf-8-sig")

print("DATA DICTIONARY CREATED")
print("File:", OUTPUT)
print("Variable groups:", df["group"].nunique())
print("Individual indicators:", len(df))
print("All variables match master scientific results.")
print("\nGroups:")
print(df.groupby("group").size().to_string())

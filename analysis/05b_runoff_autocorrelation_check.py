
from pathlib import Path
import pandas as pd
import pymannkendall as mk

ROOT = Path(__file__).resolve().parents[1]

df = pd.read_csv(
    ROOT / "data" / "indus_jjas_runoff_2001_2025.csv"
).sort_values("year")

variables = [
    "surface_runoff_mm",
    "subsurface_runoff_mm",
    "total_runoff_mm"
]

results = []

for column in variables:
    values = df[column].to_numpy()

    original = mk.original_test(values)

    # Hamed-Rao variance correction
    adjusted = mk.hamed_rao_modification_test(
        values,
        alpha=0.05,
        lag=1
    )

    results.append({
        "variable": column,
        "original_p": original.p,
        "adjusted_p": adjusted.p,
        "adjusted_trend": adjusted.trend,
        "sen_slope_mm_per_year": original.slope
    })

output = pd.DataFrame(results)

path = ROOT / "results" / "indus_runoff_autocorrelation_check.csv"
output.to_csv(path, index=False)

print("\nAUTOCORRELATION-ADJUSTED RUNOFF TRENDS")
print(output.to_string(index=False))
print("\nSaved:", path)

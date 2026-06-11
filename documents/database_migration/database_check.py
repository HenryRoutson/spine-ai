import json

with open("database_output.json") as f:
    actual = json.load(f)
with open("database_expected_output.json") as f:
    expected = json.load(f)

assert actual == expected, "FAIL: database_output.json does not match database_expected_output.json"
print("PASS")

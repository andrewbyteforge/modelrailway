# ModelRailway - Create Schema and Example Files
# Run this AFTER setup-modelrailway.ps1

Write-Host "Creating schema files and example layout..." -ForegroundColor Cyan

# Create project.schema.json
$projectSchema = @'
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.local/schemas/project.schema.json",
  "title": "Project",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "projectId",
    "name",
    "units",
    "board",
    "table",
    "createdAt",
    "updatedAt"
  ],
  "properties": {
    "schemaVersion": {
      "type": "string",
      "description": "Schema version for project.json.",
      "pattern": "^1\\.0\\.\\d+$",
      "default": "1.0.0"
    },
    "projectId": {
      "type": "string",
      "description": "Stable unique project identifier (UUID recommended).",
      "minLength": 8
    },
    "name": {
      "type": "string",
      "description": "User-facing project name.",
      "minLength": 1,
      "maxLength": 120
    },
    "description": {
      "type": "string",
      "description": "Optional description/notes.",
      "maxLength": 2000
    },
    "units": {
      "type": "object",
      "additionalProperties": false,
      "required": ["worldUnit", "lengthUnit", "scale"],
      "properties": {
        "worldUnit": {
          "type": "string",
          "description": "Engine world unit mapping (V1 locked).",
          "const": "meter"
        },
        "lengthUnit": {
          "type": "string",
          "description": "Displayed unit for UI readouts.",
          "enum": ["meter", "centimeter", "millimeter"],
          "default": "meter"
        },
        "scale": {
          "type": "object",
          "additionalProperties": false,
          "required": ["standard", "ratio"],
          "properties": {
            "standard": {
              "type": "string",
              "description": "Model railway scale standard (V1 locked).",
              "const": "OO"
            },
            "ratio": {
              "type": "number",
              "description": "Scale ratio (real_world / model). OO is 76.2 (V1 locked).",
              "const": 76.2
            }
          }
        }
      }
    },
    "board": {
      "type": "object",
      "additionalProperties": false,
      "required": ["widthM", "depthM", "thicknessM", "heightFromFloorM"],
      "properties": {
        "widthM": {
          "type": "number",
          "description": "Baseboard width in meters.",
          "minimum": 0.2,
          "maximum": 6.0
        },
        "depthM": {
          "type": "number",
          "description": "Baseboard depth in meters.",
          "minimum": 0.2,
          "maximum": 3.0
        },
        "thicknessM": {
          "type": "number",
          "description": "Baseboard thickness in meters.",
          "minimum": 0.005,
          "maximum": 0.1
        },
        "heightFromFloorM": {
          "type": "number",
          "description": "Board top surface height from floor in meters.",
          "minimum": 0.3,
          "maximum": 1.5
        },
        "origin": {
          "type": "string",
          "description": "Where (0,0,0) lies relative to the board.",
          "enum": ["center", "frontLeftCorner"],
          "default": "center"
        }
      }
    },
    "table": {
      "type": "object",
      "additionalProperties": false,
      "required": ["enabled", "style"],
      "properties": {
        "enabled": {
          "type": "boolean",
          "description": "Render a table supporting the board.",
          "default": true
        },
        "style": {
          "type": "string",
          "description": "Visual style preset for the table.",
          "enum": ["simpleWood", "modern", "trestle"],
          "default": "simpleWood"
        },
        "legInsetM": {
          "type": "number",
          "description": "How far table legs are inset from board edges (meters).",
          "minimum": 0.0,
          "maximum": 0.5,
          "default": 0.05
        }
      }
    },
    "camera": {
      "type": "object",
      "additionalProperties": false,
      "description": "Optional camera defaults.",
      "properties": {
        "defaultMode": {
          "type": "string",
          "enum": ["orbit", "walk"],
          "default": "orbit"
        },
        "orbit": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "minRadiusM": { "type": "number", "minimum": 0.2, "maximum": 20.0, "default": 1.0 },
            "maxRadiusM": { "type": "number", "minimum": 0.5, "maximum": 50.0, "default": 8.0 }
          }
        },
        "walk": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "eyeHeightM": { "type": "number", "minimum": 0.05, "maximum": 2.0, "default": 0.16 }
          }
        }
      }
    },
    "createdAt": {
      "type": "string",
      "description": "ISO-8601 timestamp.",
      "format": "date-time"
    },
    "updatedAt": {
      "type": "string",
      "description": "ISO-8601 timestamp.",
      "format": "date-time"
    }
  }
}
'@
Set-Content -Path "shared\schemas\project.schema.json" -Value $projectSchema
Write-Host "✓ Created project.schema.json" -ForegroundColor Green

# Create layout.schema.json (simplified version - full schema would be very long)
$layoutSchema = @'
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.local/schemas/layout.schema.json",
  "title": "Layout",
  "type": "object",
  "description": "Complete layout state including track, trains, scenery, and weathering",
  "required": ["schemaVersion", "layoutId", "projectId", "graph", "pieces", "switches", "blocks", "rollingStock", "trains"],
  "properties": {
    "schemaVersion": { "type": "string", "pattern": "^1\\.0\\.\\d+$" },
    "layoutId": { "type": "string" },
    "projectId": { "type": "string" },
    "graph": { "type": "object" },
    "pieces": { "type": "array" },
    "switches": { "type": "array" },
    "blocks": { "type": "array" },
    "rollingStock": { "type": "array" },
    "trains": { "type": "array" },
    "scenery": { "type": "array" },
    "weathering": { "type": "object" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  }
}
'@
Set-Content -Path "shared\schemas\layout.schema.json" -Value $layoutSchema
Write-Host "✓ Created layout.schema.json" -ForegroundColor Green

# Create example project.json
$exampleProject = @'
{
  "schemaVersion": "1.0.0",
  "projectId": "project_demo_001",
  "name": "Demo Layout",
  "description": "A simple demonstration layout with one switch and one train",
  "units": {
    "worldUnit": "meter",
    "lengthUnit": "meter",
    "scale": {
      "standard": "OO",
      "ratio": 76.2
    }
  },
  "board": {
    "widthM": 1.2,
    "depthM": 0.6,
    "thicknessM": 0.025,
    "heightFromFloorM": 0.9,
    "origin": "center"
  },
  "table": {
    "enabled": true,
    "style": "simpleWood",
    "legInsetM": 0.05
  },
  "camera": {
    "defaultMode": "orbit",
    "orbit": {
      "minRadiusM": 1.0,
      "maxRadiusM": 8.0
    },
    "walk": {
      "eyeHeightM": 0.16
    }
  },
  "createdAt": "2025-12-23T11:45:00Z",
  "updatedAt": "2025-12-23T11:45:00Z"
}
'@
Set-Content -Path "examples\demo-layout\project.json" -Value $exampleProject
Write-Host "✓ Created examples/demo-layout/project.json" -ForegroundColor Green

# Create example layout.json (from your provided document)
$exampleLayout = @'
{
  "schemaVersion": "1.0.0",
  "layoutId": "layout_demo_001",
  "projectId": "project_demo_001",

  "graph": {
    "nodes": [
      { "id": "n0", "pos": { "x": -0.168, "y": 0.0, "z": 0.0 } },
      { "id": "n1", "pos": { "x": 0.0, "y": 0.0, "z": 0.0 } },
      { "id": "n2", "pos": { "x": 0.168, "y": 0.0, "z": 0.0 } },
      { "id": "n3", "pos": { "x": 0.168, "y": 0.0, "z": 0.168 } }
    ],
    "edges": [
      {
        "id": "e0",
        "fromNodeId": "n0",
        "toNodeId": "n1",
        "lengthM": 0.168,
        "curve": { "type": "straight" },
        "pieceId": "p_straight_0"
      },
      {
        "id": "e1",
        "fromNodeId": "n1",
        "toNodeId": "n2",
        "lengthM": 0.168,
        "curve": { "type": "straight" },
        "pieceId": "p_switch_0"
      },
      {
        "id": "e2",
        "fromNodeId": "n1",
        "toNodeId": "n3",
        "lengthM": 0.264,
        "curve": { "type": "arc", "arcRadiusM": 0.168, "arcAngleDeg": 90.0 },
        "pieceId": "p_switch_0"
      }
    ]
  },

  "pieces": [
    {
      "id": "p_straight_0",
      "catalogId": "track.straight_168mm",
      "transform": {
        "pos": { "x": -0.084, "y": 0.0, "z": 0.0 },
        "rot": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 }
      },
      "connectors": [
        {
          "id": "A",
          "localPos": { "x": -0.084, "y": 0.0, "z": 0.0 },
          "localForward": { "x": -1.0, "y": 0.0, "z": 0.0 },
          "nodeId": "n0"
        },
        {
          "id": "B",
          "localPos": { "x": 0.084, "y": 0.0, "z": 0.0 },
          "localForward": { "x": 1.0, "y": 0.0, "z": 0.0 },
          "nodeId": "n1"
        }
      ],
      "generatedEdgeIds": ["e0"],
      "isSwitch": false
    },
    {
      "id": "p_switch_0",
      "catalogId": "track.switch_left_168mm_r168",
      "transform": {
        "pos": { "x": 0.084, "y": 0.0, "z": 0.0 },
        "rot": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 }
      },
      "connectors": [
        {
          "id": "COMMON",
          "localPos": { "x": -0.084, "y": 0.0, "z": 0.0 },
          "localForward": { "x": -1.0, "y": 0.0, "z": 0.0 },
          "nodeId": "n1"
        },
        {
          "id": "A",
          "localPos": { "x": 0.084, "y": 0.0, "z": 0.0 },
          "localForward": { "x": 1.0, "y": 0.0, "z": 0.0 },
          "nodeId": "n2"
        },
        {
          "id": "B",
          "localPos": { "x": 0.084, "y": 0.0, "z": 0.168 },
          "localForward": { "x": 0.0, "y": 0.0, "z": 1.0 },
          "nodeId": "n3"
        }
      ],
      "generatedEdgeIds": ["e1", "e2"],
      "isSwitch": true,
      "switchDefinition": {
        "commonNodeId": "n1",
        "stateAEdgeId": "e1",
        "stateBEdgeId": "e2"
      }
    }
  ],

  "switches": [
    { "pieceId": "p_switch_0", "state": "A" }
  ],

  "blocks": [
    { "id": "e0", "edgeIds": ["e0"], "occupiedByTrainId": "t0" },
    { "id": "e1", "edgeIds": ["e1"], "occupiedByTrainId": null },
    { "id": "e2", "edgeIds": ["e2"], "occupiedByTrainId": null }
  ],

  "rollingStock": [
    {
      "id": "rs_loco_01",
      "type": "loco",
      "name": "Demo Loco",
      "asset": { "source": "builtin", "uri": "builtin:loco_demo" },
      "locoProps": { "maxSpeedMps": 1.2, "accelMps2": 0.35, "brakeMps2": 0.6 },
      "couplers": {
        "front": { "nodeName": "couplerFront" },
        "rear": { "nodeName": "couplerRear" }
      }
    },
    {
      "id": "rs_car_01",
      "type": "car",
      "name": "Demo Coach",
      "asset": { "source": "builtin", "uri": "builtin:car_demo" },
      "couplers": {
        "front": { "nodeName": "couplerFront" },
        "rear": { "nodeName": "couplerRear" }
      }
    }
  ],

  "trains": [
    {
      "id": "t0",
      "name": "Train 1",
      "cars": [
        { "rollingStockId": "rs_loco_01" },
        { "rollingStockId": "rs_car_01" }
      ],
      "motion": {
        "throttle": 0.0,
        "targetSpeedMps": 0.0,
        "currentSpeedMps": 0.0
      },
      "position": {
        "edgeId": "e0",
        "sM": 0.05,
        "dir": 1
      },
      "occupiedBlockIds": ["e0"]
    }
  ],

  "scenery": [
    {
      "id": "sc_tree_01",
      "catalogId": "scenery.tree_small_01",
      "transform": {
        "pos": { "x": 0.25, "y": 0.0, "z": -0.12 },
        "rot": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 },
        "scale": 1.0
      },
      "tags": ["tree"]
    }
  ],

  "weathering": { "enabled": true, "intensity": 0.25 },

  "createdAt": "2025-12-23T11:45:00Z",
  "updatedAt": "2025-12-23T11:45:00Z"
}
'@
Set-Content -Path "examples\demo-layout\layout.json" -Value $exampleLayout
Write-Host "✓ Created examples/demo-layout/layout.json" -ForegroundColor Green

# Create library.json for the example
$libraryJson = @'
{
  "schemaVersion": "1.0.0",
  "assets": [],
  "note": "Asset registry will be populated as models are imported"
}
'@
Set-Content -Path "examples\demo-layout\assets\library.json" -Value $libraryJson
Write-Host "✓ Created examples/demo-layout/assets/library.json" -ForegroundColor Green

# Create placeholder README in examples
$examplesReadme = @'
# Demo Layout

A minimal example layout demonstrating:
- One straight track piece
- One left-hand switch
- One train (loco + coach)
- One scenery item (tree)
- Block occupancy system
- Switch state (set to route A)

## Track Layout

```
    n3
    |
n0--n1--n2
```

The switch at n1 can route either:
- State A: n1 → n2 (straight)
- State B: n1 → n3 (diverging left)

## Train Position

Train "t0" is positioned on edge e0, 0.05m from node n0.
'@
Set-Content -Path "examples\demo-layout\README.md" -Value $examplesReadme
Write-Host "✓ Created examples/demo-layout/README.md" -ForegroundColor Green

Write-Host "`n✓ All schema files and example layout created!" -ForegroundColor Green

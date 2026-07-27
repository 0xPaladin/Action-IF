# Suggested Tag Vocabulary for Stunts/Items

## Goal

Create a curated list of ~55 suggested tags ensuring every one of the 12 actions has ~5 associated tags. Tags are free-form strings (no enforcement), but this list provides a consistent vocabulary for game creators to use in stunt/item/scene/challenge definitions.

## Background

Tags are matched via `findApplicableEffects(effectors, tags)` in `src/stunt.js:14` — any overlap between an effector's tags and the scene+challenge tags activates the effector. Currently tags are completely free-form with no central registry.

## Proposed Tag List (55 tags)

### Environmental (12)
| Tag | Description |
|---|---|
| `outdoor` | Open-air environments, exterior spaces |
| `indoor` | Enclosed indoor spaces, buildings, rooms |
| `urban` | City streets, buildings, populated areas |
| `wilderness` | Untamed nature, forests, mountains, remote areas |
| `underground` | Caves, tunnels, subway, basement levels |
| `dark` | Low-light or no-light conditions |
| `night` | Nighttime, evening, after dark |
| `ancient` | Old, historical, pre-cataclysm architecture or artifacts |
| `modern` | Contemporary, recent construction or technology |
| `industrial` | Factories, warehouses, machinery, industrial zones |
| `natural` | Natural formations, terrain, weather, flora/fauna |
| `magical` | Supernatural, mystical, arcane energy present |

### Situation (10)
| Tag | Description |
|---|---|
| `combat` | Direct physical confrontation or fighting |
| `social` | Social interaction, negotiation, conversation |
| `stealth` | Sneaking, hiding, moving quietly |
| `investigation` | Gathering clues, analyzing evidence, detective work |
| `chase` | Pursuit or escape, rapid movement |
| `ritual` | Formalized magical or ceremonial activity |
| `puzzle` | Logic puzzles, locks, riddles, problem-solving |
| `exploration` | Discovering new areas, mapping, navigating |
| `survival` | Enduring harsh conditions, finding shelter/food |
| `performance` | Public speaking, entertainment, acting |

### Tactical/Approach (11)
| Tag | Description |
|---|---|
| `brute` | Raw physical force, breaking through obstacles |
| `precision` | Fine motor control, exact timing, careful aim |
| `mobility` | Movement, positioning, getting into/out of places |
| `evasion` | Avoiding attacks, dodging, escaping danger |
| `concentration` | Sustained mental focus, resisting distraction |
| `supportive` | Helping allies, providing cover, morale support |
| `deceptive` | Misdirection, lying, hiding true intentions |
| `authoritative` | Commanding, ordering, asserting authority |
| `mental` | Mental tasks, logic, memory, willpower |
| `analytical` | Breaking down information, pattern recognition |
| `intimidating` | Scaring, threatening, imposing presence |

### Equipment/Medium (8)
| Tag | Description |
|---|---|
| `weapon` | Firearms, blades, improvised weapons |
| `tech` | Electronic devices, computers, modern technology |
| `arcane` | Magic, mystical energies, supernatural phenomena |
| `mechanical` | Gears, levers, pulleys, clockwork mechanisms |
| `electronic` | Circuits, screens, digital interfaces |
| `alchemical` | Potions, chemicals, transmutation, lab work |
| `ranged` | Attacks at a distance, line of sight |
| `workshop` | Crafting space, tools, workbench, laboratory |

### Specific Context (9)
| Tag | Description |
|---|---|
| `protective` | Guarding, defending, shielding something or someone |
| `guarded` | Under watch, patrolled, security present |
| `locked` | Barriers, doors, containers that need opening |
| `trapped` | Dangerous mechanisms, tripwires, hidden hazards |
| `surveillance` | Watching, monitoring, being observed |
| `perception` | Sensing, noticing, detecting through observation |
| `tracking` | Following signs, predicting movement, reading traces |
| `leadership` | Organizing groups, strategic planning, command |
| `research` | Studying texts, gathering knowledge, academic work |

### Social/Role (5)
| Tag | Description |
|---|---|
| `team` | Group activities, cooperation, party dynamics |
| `charm` | Charisma, likability, winning people over |
| `diplomatic` | Negotiation, peace-making, formal relations |
| `morale` | Emotional state, group spirit, motivation |
| `crafting` | Creating, building, modifying items or structures |

**Total: 55 tags** (under the ~60 maximum)

## Action-to-Tag Mapping (5 tags per action)

| Action | Tags |
|---|---|
| **Muscle** (force, overcome, wreck) | `combat`, `brute`, `intimidating`, `outdoor`, `protective` |
| **Move** (shift, escape) | `mobility`, `evasion`, `stealth`, `chase`, `outdoor` |
| **Finesse** (manipulation, misdirection) | `precision`, `stealth`, `tech`, `locked`, `deceptive` |
| **Sneak** (quiet traversal) | `stealth`, `dark`, `underground`, `tracking`, `evasion` |
| **Shoot** (ranged combat) | `combat`, `ranged`, `precision`, `dark`, `weapon` |
| **Tinker** (mechanisms) | `tech`, `mechanical`, `electronic`, `arcane`, `workshop` |
| **Study** (analyze) | `investigation`, `research`, `surveillance`, `analytical`, `ancient` |
| **Notice** (observe) | `perception`, `surveillance`, `tracking`, `dark`, `natural` |
| **Bond** (socialize) | `social`, `supportive`, `team`, `diplomatic`, `morale` |
| **Command** (compel) | `social`, `authoritative`, `leadership`, `team`, `intimidating` |
| **Focus** (concentrate) | `concentration`, `mental`, `arcane`, `ritual`, `analytical` |
| **Sway** (influence) | `social`, `charm`, `deceptive`, `diplomatic`, `performance` |

## Overlap Analysis

- 12 actions × 5 tags = 60 tag slots
- 41 unique tags appear in action mappings
- 16 tags are shared across 2+ actions (e.g., `stealth` on Move/Finesse/Sneak, `social` on Bond/Command/Sway, `dark` on Sneak/Shoot/Notice)
- 14 tags in the full list are not directly mapped to any action but serve as general-purpose scene/challenge tags (e.g., `indoor`, `urban`, `puzzle`, `trapped`, `alchemical`)

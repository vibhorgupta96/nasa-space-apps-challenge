// Every value here is an untested game-balance choice, not a NASA measurement (PLAN.md section 6).
export const RULES = {
  cellsPerSol: 6,
  initialShields: 0,
  initialAir: 100,
  initialFood: 80,
  initialSeeds: 24,
  initialWater: 48,
  initialOtherItems: 0,
  plotCount: 12,
  missionSols: 10,
  resourceMax: 100,
  rescueAt: 0,
  solDurationMs: 120_000, // planning is paused; active day lasts two real minutes
  stormHitOffsetMs: 60_000, // within its game sol
  stormWarningSols: 2,
  roverMsPerTile: 4_000, // advances on the same active clock
  roverCostPerTile: 0.1, // multiplied by terrain cost 1–3
  growLightsPlotsPerCell: 4, // lowest-numbered eligible plots receive light first
  airLossPerSol: 10,
  airPerHealthyLitCrop: 3,
  foodLossPerSol: 8,
  stormAirLoss: 15,
  heaterNeededBelowC: -97, // game threshold applied to the sourced InSight minimum; picked so only some sols need it
  icePerWaterConversion: 1,
  waterPerIceConversion: 2,
  waterPerPlant: 1,
  waterPerPlotPerSol: 1,
  snackBelowFood: 40, // at night the crew eats raw pantry crops while food is below this
  regolithPerShieldLayer: 3,
  maxShieldLayers: 3,
  roverDisabledSols: 1,
  radioMsPerMinute: 1_000,
  moxieAirPerCell: 6, // weaker than a grow-light cell on a full garden, stronger on an empty one
  dustCellsLost: 1, // a dusty panel makes this many fewer cells until it is cleaned
  requestRewardSeeds: 2,
  lifeSupportAir: 70, // air at or above this at night counts towards the Life Support badge
  badgeSols: 3, // sols needed for the Life Support, Power Planner and Fit Astronaut badges
  scholarLessons: 7,
  moonwalkAirCost: 4, // suit oxygen for one Moonwalk (game rule)
  moonwalkMinAir: 20, // too little air in the habitat to fill a suit below this
};

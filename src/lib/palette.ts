/** Lane colors: earthy and dark enough to read on the sand surface. */
export const LANE_COLORS = [
  '#3E5F44', // forest
  '#8A5A2B', // bark
  '#2D6A72', // lagoon
  '#6E6E18', // olive
  '#6B3E5E', // plum
  '#3F5A8A', // slate
  '#5B7F2E', // leaf
];

export const laneColor = (index: number) => LANE_COLORS[index % LANE_COLORS.length];

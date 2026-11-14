export interface HelpPage {
  title: string;
  lines: string[];
}

export function createHelpPages(cellsPerSol: number, heaterNeededBelowC: number): HelpPage[];

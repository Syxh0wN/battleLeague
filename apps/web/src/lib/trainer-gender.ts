export type TrainerGender = "male" | "female" | null | undefined;

export function GetTrainerLabel(gender: TrainerGender) {
  return gender === "female" ? "Treinadora" : "Treinador";
}

export function GetTrainerLabelLower(gender: TrainerGender) {
  return gender === "female" ? "treinadora" : "treinador";
}

export function GetTrainerPossessive(gender: TrainerGender) {
  return gender === "female" ? "da treinadora" : "do treinador";
}

export const PASSWORD_MIN_LENGTH = 12;

export type PasswordRule = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "At least 12 characters",
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "case",
    label: "Upper and lowercase letters",
    test: (password) => /[a-z]/.test(password) && /[A-Z]/.test(password),
  },
  {
    id: "number",
    label: "At least one number",
    test: (password) => /\d/.test(password),
  },
  {
    id: "special",
    label: "At least one special character",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export function passwordIssues(password: string) {
  return PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.label);
}

export function passwordIsValid(password: string) {
  return passwordIssues(password).length === 0;
}

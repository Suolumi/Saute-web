import {apiFetch, apiFetchJson} from "$lib/api";

// isPasswordValid mirrors the API's utils.IsPasswordValid: at least 12 characters,
// a digit and a character that is neither an ASCII letter nor a digit.
export function isPasswordValid(password: string): boolean {
    return [...password].length >= 12 && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)
}

export type LoginRequest = {
    id: string
    password: string
}
export type LoginResponse = {
    access_token: string
    refresh_token: string
}
export function login(data: LoginRequest) {
    return apiFetchJson<LoginResponse>("/login", "POST", data)
}

export type RegisterRequest = {
    email: string
    username: string
    password: string
}
export type RegisterResponse = {
    access_token: string
    refresh_token: string
}
export function register(data: RegisterRequest) {
    return apiFetchJson<RegisterResponse>("/register", "POST", data)
}

export type ForgotPasswordRequest = {
    id: string
    locale: string
}
export function forgotPassword(data: ForgotPasswordRequest) {
    return apiFetch("/forgot-password", "POST", data)
}

export type ResetPasswordRequest = {
    password: string
}
export function resetPassword(data: ResetPasswordRequest, token: string) {
    return apiFetch(`/forgot-password/${token}`, "POST", data)
}

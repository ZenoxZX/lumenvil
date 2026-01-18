namespace Backend.Models.DTOs;

public record LoginRequest(string Username, string Password);

public record RegisterRequest(string Username, string Email, string Password, UserRole Role = UserRole.Developer);

public record AuthResponse(string Token, UserResponse User);

public record UserResponse(Guid Id, string Username, string Email, UserRole Role, DateTime CreatedAt, DateTime? LastLoginAt);

public record CreateUserRequest(string Username, string Email, string Password, UserRole Role = UserRole.Developer);

public record UpdateRoleRequest(UserRole Role);

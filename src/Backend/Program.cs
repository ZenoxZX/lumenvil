using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Backend.Data;
using Backend.Hubs;
using Backend.Models;
using Backend.Services;
using Backend.Services.Notifications;
using Backend.Services.Platforms;
using Backend.Services.Platforms.Steam;
using DotNetEnv;

// Load .env file
Env.Load();

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// JWT Authentication
var jwtKey = Environment.GetEnvironmentVariable("JWT_KEY")
    ?? builder.Configuration["Jwt:Key"]
    ?? throw new Exception("JWT_KEY not configured");
var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER")
    ?? builder.Configuration["Jwt:Issuer"]
    ?? "BuildAutomation";
var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE")
    ?? builder.Configuration["Jwt:Audience"]
    ?? "BuildAutomation";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };

        // Allow SignalR to receive token from query string
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// SignalR
builder.Services.AddSignalR();

// Services
builder.Services.AddScoped<AuthService>();
builder.Services.AddSingleton<IGitApiService, GitApiService>();
builder.Services.AddSingleton<BuildQueueService>();
builder.Services.AddHostedService(provider => provider.GetRequiredService<BuildQueueService>());

// Settings & Platform Services
builder.Services.AddSingleton<SettingsService>();
builder.Services.AddSingleton<PlatformUploaderFactory>();

// Notification Services
builder.Services.AddHttpClient("notifications");
builder.Services.AddSingleton<NotificationService>();

// Build Cleanup Service
builder.Services.AddSingleton<BuildCleanupService>();
builder.Services.AddHostedService(provider => provider.GetRequiredService<BuildCleanupService>());

// Code Generator Service
builder.Services.AddSingleton<CodeGeneratorService>();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowDashboard", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://127.0.0.1:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

// Configure pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseDeveloperExceptionPage();
}

app.UseCors("AllowDashboard");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<BuildHub>("/hubs/build");

// Initialize database and seed admin user
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    context.Database.EnsureCreated();

    // Seed admin user if not exists
    if (!context.Users.Any())
    {
        var adminUsername = Environment.GetEnvironmentVariable("ADMIN_USERNAME") ?? "admin";
        var adminPassword = Environment.GetEnvironmentVariable("ADMIN_PASSWORD") ?? "admin123";
        var adminEmail = Environment.GetEnvironmentVariable("ADMIN_EMAIL") ?? "admin@buildautomation.local";

        var adminUser = new User
        {
            Id = Guid.NewGuid(),
            Username = adminUsername,
            Email = adminEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
            Role = UserRole.Admin,
            CreatedAt = DateTime.UtcNow
        };
        context.Users.Add(adminUser);
        context.SaveChanges();
        Console.WriteLine($"Admin user created - Username: {adminUsername}");
    }
}

app.Run();

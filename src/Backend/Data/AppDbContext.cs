using Microsoft.EntityFrameworkCore;
using Backend.Models;

namespace Backend.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Build> Builds => Set<Build>();
    public DbSet<BuildLog> BuildLogs => Set<BuildLog>();
    public DbSet<BuildTemplate> BuildTemplates => Set<BuildTemplate>();
    public DbSet<BuildPipeline> BuildPipelines => Set<BuildPipeline>();
    public DbSet<BuildProcess> BuildProcesses => Set<BuildProcess>();
    public DbSet<Setting> Settings => Set<Setting>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Username).IsUnique();
            entity.HasIndex(e => e.Email).IsUnique();
        });

        modelBuilder.Entity<Project>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Name).IsUnique();
        });

        modelBuilder.Entity<Build>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.ProjectId, e.BuildNumber }).IsUnique();

            entity.HasOne(e => e.Project)
                .WithMany(p => p.Builds)
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.TriggeredBy)
                .WithMany(u => u.TriggeredBuilds)
                .HasForeignKey(e => e.TriggeredById)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<BuildLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.BuildId);

            entity.HasOne(e => e.Build)
                .WithMany(b => b.Logs)
                .HasForeignKey(e => e.BuildId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Setting>(entity =>
        {
            entity.HasKey(e => e.Key);
        });

        modelBuilder.Entity<BuildTemplate>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Name);

            entity.HasOne(e => e.Project)
                .WithMany()
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.CreatedBy)
                .WithMany()
                .HasForeignKey(e => e.CreatedById)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<BuildPipeline>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Name);

            entity.HasOne(e => e.Project)
                .WithMany()
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.CreatedBy)
                .WithMany()
                .HasForeignKey(e => e.CreatedById)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<BuildProcess>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.PipelineId, e.Order });

            entity.HasOne(e => e.Pipeline)
                .WithMany(p => p.Processes)
                .HasForeignKey(e => e.PipelineId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}

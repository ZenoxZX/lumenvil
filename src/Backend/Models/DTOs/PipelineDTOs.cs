namespace Backend.Models.DTOs;

// Pipeline DTOs

public record CreatePipelineRequest(
    string Name,
    string? Description,
    Guid? ProjectId,
    bool IsDefault = false
);

public record UpdatePipelineRequest(
    string? Name,
    string? Description,
    bool? IsDefault,
    bool? IsActive
);

public record PipelineResponse(
    Guid Id,
    string Name,
    string? Description,
    Guid? ProjectId,
    string? ProjectName,
    bool IsDefault,
    bool IsActive,
    int ProcessCount,
    DateTime CreatedAt,
    string? CreatedByUsername
);

public record PipelineDetailResponse(
    Guid Id,
    string Name,
    string? Description,
    Guid? ProjectId,
    string? ProjectName,
    bool IsDefault,
    bool IsActive,
    List<ProcessResponse> Processes,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    string? CreatedByUsername
);

// Process DTOs

public record CreateProcessRequest(
    string Name,
    ProcessType Type,
    BuildPhase Phase,
    int Order,
    object Configuration
);

public record UpdateProcessRequest(
    string? Name,
    BuildPhase? Phase,
    int? Order,
    object? Configuration,
    bool? IsEnabled
);

public record ProcessResponse(
    Guid Id,
    Guid PipelineId,
    string Name,
    ProcessType Type,
    BuildPhase Phase,
    int Order,
    object Configuration,
    bool IsEnabled,
    DateTime CreatedAt
);

public record ReorderProcessesRequest(
    List<Guid> ProcessIds
);

// Process type info for UI

public record ProcessTypeInfo(
    ProcessType Type,
    string Name,
    string Description,
    BuildPhase DefaultPhase,
    object DefaultConfiguration
);

/**
 * HEB Waste Tuning Dashboard - Query Library
 * 
 * Organized collection of SQL queries for the dashboard.
 * 
 * Query Types:
 *   - onLoad: Queries that run automatically when the dashboard loads
 *   - presets: User-clickable preset queries, organized by category
 * 
 * Query Structure:
 *   - id: Unique identifier (used for React keys, etc.)
 *   - name: Display name shown in the UI
 *   - description: Brief explanation of what the query does
 *   - sql: The SQL query (use ? for parameters)
 *   - params: Default parameter values (optional)
 *   - isBatch: true if query contains multiple statements (requires special backend handling)
 */

// =============================================================================
// ON-LOAD QUERIES
// These run automatically when the dashboard initializes
// =============================================================================

export const onLoadQueries = [
  {
    id: 'active-config-version',
    name: 'Active Config Version',
    description: 'Shows the currently active configuration version',
    sql: `
      SELECT 
        [VersionID],
        [VersionName],
        [Comment],
        [CreatedBy],
        [CreatedOnUTC],
        [IsActive],
        [ActivatedBy],
        [ActivatedOnUTC],
        [IsLocked],
        [LockedBy],
        [LockedOnUTC],
        [IsProtected],
        [ProtectedBy],
        [ProtectedOnUTC],
        [ClonedFromVersionID]
      FROM [WASTE_HEB].[config].[ConfigVersions]
      WHERE IsActive = 1
    `,
    params: []
  },
  {
    id: 'max-config-version',
    name: 'MAX Config Version',
    description: 'Shows the highest VersionID (most recently created version). Only displayed if different from active.',
    sql: `
      SELECT 
        [VersionID],
        [VersionName],
        [Comment],
        [CreatedBy],
        [CreatedOnUTC],
        [IsActive],
        [ActivatedBy],
        [ActivatedOnUTC],
        [IsLocked],
        [LockedBy],
        [LockedOnUTC],
        [IsProtected],
        [ProtectedBy],
        [ProtectedOnUTC],
        [ClonedFromVersionID]
      FROM [WASTE_HEB].[config].[ConfigVersions]
      WHERE VersionID = (SELECT MAX(VersionID) FROM [WASTE_HEB].[config].[ConfigVersions])
    `,
    params: []
  },
];

// =============================================================================
// DASHBOARD QUERIES
// Queries for specific dashboard sections (loaded on demand or on page load)
// =============================================================================

export const dashboardQueries = {
  'current-default-markdowns': {
    id: 'current-default-markdowns',
    name: 'Current Default Markdowns',
    description: 'PPG Cluster markdown percentages with dynamic pivot by DaysToExpiry/HoursToSell/MinQty',
    isBatch: true,  // This query uses temp tables and dynamic SQL
    sql: `
/*******************************************************************************
PART 1: DATA COLLECTION
*******************************************************************************/

-- Cleanup
IF OBJECT_ID('tempdb..#All_Tune') IS NOT NULL DROP TABLE #All_Tune;
IF OBJECT_ID('tempdb..#Unique_PPGClusterID') IS NOT NULL DROP TABLE #Unique_PPGClusterID;
IF OBJECT_ID('tempdb..##PivotBase') IS NOT NULL DROP TABLE ##PivotBase;

-- 1. Get current version
DECLARE @CurrentVersion INT = (
    SELECT [VersionID]
    FROM [WASTE_HEB].[config].[ConfigVersions]
    WHERE IsActive = 1
);

-- 2. Identify the primary hierarchy for each PPG
WITH RankedItems AS (
    SELECT
        i.PPGClusterID,
        i.HierarchyLevel5ID,
        iml.HierarchyLevel5Name,
        i.HierarchyLevel4ID,
        iml.HierarchyLevel4Name,
        i.HierarchyLevel3ID,
        iml.HierarchyLevel3Name,
        i.HierarchyLevel2ID,
        iml.HierarchyLevel2Name,
        i.HierarchyLevel1ID,
        iml.HierarchyLevel1Name,
        COUNT(iml.UniqueItemID) AS CountOfItems,
        ROW_NUMBER() OVER (PARTITION BY i.PPGClusterID ORDER BY COUNT(iml.UniqueItemID) DESC) AS rn
    FROM [WASTE_HEB].[dbo].[Item] i
    LEFT JOIN [WASTE_HEB].[dbo].[ItemML] iml ON i.UniqueItemID = iml.UniqueItemID
    GROUP BY
        i.PPGClusterID,
        i.HierarchyLevel5ID, iml.HierarchyLevel5Name,
        i.HierarchyLevel4ID, iml.HierarchyLevel4Name,
        i.HierarchyLevel3ID, iml.HierarchyLevel3Name,
        i.HierarchyLevel2ID, iml.HierarchyLevel2Name,
        i.HierarchyLevel1ID, iml.HierarchyLevel1Name
)
SELECT * INTO #Unique_PPGClusterID
FROM RankedItems
WHERE rn = 1;

-- 3. Populate #All_Tune with source tables
SELECT
    f.PPGClusterID,
    f.StoreClusterID,
    f.DaysToExpiry,
    f.MinQty,
    f.HoursToSell,
    f.ReductionPct,
    dp.Scalar AS Default_Scalar,
    dp.GeneratedScalar,
    dp.ConfiguredScalar,
    dte.Scalar AS DTE1_Scalar,
    cfgdp.ConfigValue,
    cfgdp.ConfigOperationType,
    ip.HierarchyLevel4Name,
    ip.HierarchyLevel3Name,
    ip.HierarchyLevel2Name,
    ip.HierarchyLevel1Name
INTO #All_Tune
FROM [WASTE_HEB].wmd.ScalarFinalPercentage f
LEFT JOIN #Unique_PPGClusterID ip ON f.PPGClusterID = ip.PPGClusterID
LEFT JOIN [WASTE_HEB].wmd.ScalarDefaultPercentage dp ON f.PPGClusterID = dp.PPGClusterID
LEFT JOIN (
    SELECT PPGClusterID, DaysToExpiry, Scalar
    FROM [WASTE_HEB].wmd.ScalarDaysToExpiry
    WHERE DaysToExpiry = 1
) dte ON f.PPGClusterID = dte.PPGClusterID
LEFT JOIN (
    SELECT PPGClusterID, ConfigValue, ConfigOperationType, VersionID
    FROM [WASTE_HEB].[config].[DefaultPercentage]
    WHERE VersionID = @CurrentVersion
) cfgdp ON f.PPGClusterID = cfgdp.PPGClusterID
WHERE f.MinQty IN (1,2,5,11,20)
  AND f.HoursToSell IN (3, 6, 10, 99)
  AND f.DaysToExpiry IN (0,1,2);

/*******************************************************************************
PART 2: DYNAMIC PIVOT (Collapsed to PPG Level)
*******************************************************************************/

-- 1. Create the base and COLLAPSE multiple stores/days into a single average per PPG/Config
SELECT
    HierarchyLevel4Name,
    HierarchyLevel3Name,
    HierarchyLevel2Name,
    HierarchyLevel1Name,
    PPGClusterID,
    Default_Scalar,
    GeneratedScalar,
    ConfiguredScalar,
    ConfigValue,
    ConfigOperationType,
    DTE1_Scalar,
    DaysToExpiry,
    HoursToSell,
    MinQty,
    'D' + CAST(DaysToExpiry AS VARCHAR) + '_H' + CAST(HoursToSell AS VARCHAR) + '_M' + CAST(MinQty AS VARCHAR) as ConfigKey,
    AVG(ReductionPct) as AvgReductionPct
INTO ##PivotBase
FROM #All_Tune
WHERE StoreClusterID <> -1
  AND PPGClusterID IN ('677','678','679','702','9227','9228','9229','9230','9231','9470','1098','769','771','9360','9361','9362','9363','9364','9365','9366','9367','9368','9437','9217','9233','1140','1141','1142','1143','1144','1284','1298','1300','1309','1328','1338','496','11','1519','1520','1521','1533','1552','12','1201','1431','1043','1044','1599','480','481','5335','5336','5337','8794','5332','5333','1316','5160','5161','5162','5164','5166','5170','8705','8758','8759','8760','8761','8762','8767','8768','8769','8770','8771','8772','8788','8815','455','456','457','458','467','8791','4621','8808','8813','8821','8822','8825','8810','8823','8824','5361','5416','8773','4626','5353','5364','8809','8814','5389','5391','5393','5405')
GROUP BY
    HierarchyLevel4Name,
    HierarchyLevel3Name,
    HierarchyLevel2Name,
    HierarchyLevel1Name,
    PPGClusterID,
    Default_Scalar,
    GeneratedScalar,
    ConfiguredScalar,
    ConfigValue,
    ConfigOperationType,
    DTE1_Scalar,
    DaysToExpiry,
    HoursToSell,
    MinQty;

-- 2. Build the columns with exact sort
DECLARE @Cols NVARCHAR(MAX) = STUFF((
    SELECT ', ' + QUOTENAME(ConfigKey)
    FROM (SELECT DISTINCT ConfigKey, DaysToExpiry, HoursToSell, MinQty FROM ##PivotBase) AS SortTable
    ORDER BY DaysToExpiry ASC, HoursToSell ASC, MinQty DESC
    FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'
), 1, 2, '');

-- 3. Execute the Final Flattened Pivot
DECLARE @SQL NVARCHAR(MAX) = '
SELECT
    HierarchyLevel4Name,
    HierarchyLevel3Name,
    HierarchyLevel2Name,
    HierarchyLevel1Name,
    PPGClusterID,
    Default_Scalar,
    GeneratedScalar,
    ConfiguredScalar,
    ConfigValue,
    ConfigOperationType,
    DTE1_Scalar,
    ' + @Cols + '
FROM (
    SELECT
        HierarchyLevel4Name,
        HierarchyLevel3Name,
        HierarchyLevel2Name,
        HierarchyLevel1Name,
        PPGClusterID,
        Default_Scalar,
        GeneratedScalar,
        ConfiguredScalar,
        ConfigValue,
        ConfigOperationType,
        DTE1_Scalar,
        ConfigKey,
        AvgReductionPct
    FROM ##PivotBase
) AS SourceTable
PIVOT (
    MAX(AvgReductionPct)
    FOR ConfigKey IN (' + @Cols + ')
) AS pvt
ORDER BY HierarchyLevel4Name, HierarchyLevel3Name, HierarchyLevel2Name, HierarchyLevel1Name, PPGClusterID;'
;

EXEC sp_executesql @SQL;

-- Final Cleanup
IF OBJECT_ID('tempdb..##PivotBase') IS NOT NULL DROP TABLE ##PivotBase;
    `,
    params: []
  }
};

// =============================================================================
// PRESET QUERIES
// User-clickable queries organized by category
// =============================================================================

export const presetCategories = [
  {
    id: 'config-versions',
    name: '⚙️ Config Versions',
    description: 'View and manage configuration versions',
    queries: [
      {
        id: 'all-config-versions',
        name: 'All Config Versions',
        description: 'List all configuration versions',
        sql: `
          SELECT 
            [VersionID],
            [VersionName],
            [Comment],
            [CreatedBy],
            [CreatedOnUTC],
            [IsActive],
            [IsLocked],
            [IsProtected],
            [ClonedFromVersionID]
          FROM [WASTE_HEB].[config].[ConfigVersions]
          ORDER BY [CreatedOnUTC] DESC
        `,
        params: []
      },
      {
        id: 'locked-versions',
        name: 'Locked Versions',
        description: 'Show all locked configuration versions',
        sql: `
          SELECT 
            [VersionID],
            [VersionName],
            [LockedBy],
            [LockedOnUTC],
            [Comment]
          FROM [WASTE_HEB].[config].[ConfigVersions]
          WHERE IsLocked = 1
          ORDER BY [LockedOnUTC] DESC
        `,
        params: []
      }
    ]
  },
  {
    id: 'waste-analysis',
    name: '🗑️ Waste Analysis',
    description: 'Queries for analyzing waste patterns',
    queries: [
      // Add your waste analysis queries here...
    ]
  },
  {
    id: 'tuning-params',
    name: '🎛️ Tuning Parameters',
    description: 'View and analyze tuning configurations',
    queries: [
      // Add your tuning parameter queries here...
    ]
  },
  {
    id: 'diagnostics',
    name: '🔍 Diagnostics',
    description: 'Database health and diagnostic queries',
    queries: [
      {
        id: 'table-row-counts',
        name: 'Table Row Counts',
        description: 'Row counts for all tables in WASTE_HEB',
        sql: `
          SELECT 
            s.name AS schema_name,
            t.name AS table_name,
            p.rows AS row_count
          FROM [WASTE_HEB].sys.tables t
          INNER JOIN [WASTE_HEB].sys.schemas s ON t.schema_id = s.schema_id
          INNER JOIN [WASTE_HEB].sys.partitions p ON t.object_id = p.object_id
          WHERE p.index_id IN (0, 1)
          ORDER BY p.rows DESC
        `,
        params: []
      }
    ]
  }
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all preset queries as a flat array
 */
export const getAllPresets = () => {
  return presetCategories.flatMap(cat => 
    cat.queries.map(q => ({ ...q, category: cat.name }))
  );
};

/**
 * Find a query by ID (searches onLoad, dashboard, and presets)
 */
export const findQueryById = (id) => {
  // Check onLoad queries
  const onLoad = onLoadQueries.find(q => q.id === id);
  if (onLoad) return onLoad;
  
  // Check dashboard queries
  if (dashboardQueries[id]) return dashboardQueries[id];
  
  // Check preset queries
  for (const category of presetCategories) {
    const found = category.queries.find(q => q.id === id);
    if (found) return found;
  }
  
  return null;
};

/**
 * Get queries that require user parameters
 */
export const getParameterizedQueries = () => {
  return getAllPresets().filter(q => q.params && q.params.length > 0);
};

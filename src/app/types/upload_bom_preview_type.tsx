export type ValidationField = { value: string; status: "ok" | "error" | "same" | "update" | "new" };
export type RubberItem = { rubber_formular: string; status: string; fields: Record<string, ValidationField>; warning?: string };
export type SteelItem = { steel_code: string; status: string; fields: Record<string, ValidationField> };
export type RmItem = { rm_item: string; status: string; fields: Record<string, ValidationField>; message?: string; error?: string };
export type ProdItem = { item_code: string; status: string; fields: Record<string, ValidationField>; message?: string; warning?: string };

export type PreviewResult = {
    status: "success";
    rubber_validation: RubberItem[];
    steel_validation: SteelItem[];
    rm_validation: RmItem[];
    prod_validation: ProdItem[];
};

export type StatusPayload = {
    job_id: string;
    status: "queued" | "running" | "finished" | "error" | "unknown";
    progress?: number;
    stage?: string;
    message?: string;          
    result?: PreviewResult;
};

export type EnqueueResponse =
    | { status: "queued"; job_id: string; topic: string }
    | { status: "error"; message: string };


export type EnqueueQueued = { status: "queued"; job_id: string; topic: string };
export type EnqueueError  = { status: "error"; message: string };
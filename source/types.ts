type stateValue = string | number | boolean;
type dataValue = string | number | boolean | null;
type dataMap = Map<string, dataValue>;
type funcCode = (data:{states:dataMap, inputs:dataMap}) => void;
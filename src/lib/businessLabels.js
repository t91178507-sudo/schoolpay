export function isSchoolBusinessType(businessType = "") {
  return String(businessType).trim().toLowerCase() === "school";
}

export function getCustomerLabels(businessType = "") {
  const isSchool = isSchoolBusinessType(businessType);

  return {
    singular: isSchool ? "student" : "customer",
    plural: isSchool ? "students" : "customers",
    singularTitle: isSchool ? "Student" : "Customer",
    pluralTitle: isSchool ? "Students" : "Customers",
  };
}

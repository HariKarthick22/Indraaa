use super::*;
use crate::agents::specialists::SpecialistRegistry;

impl GooseAcpAgent {
    pub(super) async fn on_specialists_list(
        &self,
        _req: ListSpecialistsRequest,
    ) -> Result<ListSpecialistsResponse, agent_client_protocol::Error> {
        let specialists = SpecialistRegistry::new()
            .list()
            .iter()
            .map(|specialist| SpecialistInfo {
                name: specialist.name().to_string(),
                description: specialist.description().to_string(),
            })
            .collect();

        Ok(ListSpecialistsResponse { specialists })
    }
}

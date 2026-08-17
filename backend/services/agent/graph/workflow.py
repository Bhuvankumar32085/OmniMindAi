from langgraph.graph import StateGraph

from graph.state import AgentState
from graph.nodes import register_nodes
from graph.edges import register_edges


builder = StateGraph(AgentState)

register_nodes(builder)
register_edges(builder)

graph = builder.compile()

